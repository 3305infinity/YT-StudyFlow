import type { ResponseLanguageId } from '../lib/languages.js';
import { normalizeLanguageId } from '../lib/languages.js';
import { geminiService } from './gemini.service.js';
import { ragService, type ScoredChunkResult } from './rag.service.js';
import { promptBuilderService } from './promptBuilder.service.js';
import { citationService, type Citation } from './citation.service.js';
import { contextPackingService, type PackedContext } from './contextPacking.service.js';
import { analyzeRetrieval } from './rag/coverage.js';
import type { CoverageCase } from './rag/coverage.js';
import { computeConfidence } from './rag/confidence.js';
import type { ConfidenceLabel } from './rag/confidence.js';
import { lectureRelatedTopicsFromRetrieval } from './rag/relatedTopics.js';
import { coverageToMode } from './rag/responseMode.js';
import type { ResponseMode } from './rag/responseMode.js';
import { ragDevLog } from './rag/devLog.js';
import { metricsService } from './metrics.service.js';
import { retrievalMetrics, type RetrievalMetrics } from './retrievalMetrics.js';
import { requestDeduplicator } from '../performance/requestDeduplicator.js';
import { withTimeout } from '../reliability/timeout.js';

export type RetrievalMetadata = {
  coverage: CoverageCase;
  confidenceLabel: ConfidenceLabel;
  maxSimilarity: number;
  avgTopSimilarity: number;
  chunkCount: number;
  topChunkIds: string[];
  promptLengthChars: number;
  geminiLatencyMs: number;
};

export type StructuredChatResponse = {
  mode: ResponseMode;
  summary: string;
  lectureContent: string;
  additionalExplanation: string;
  generalKnowledge: string;
  keyTakeaways: string[];
  lectureRelatedTopics: string[];
  suggestedRelatedTopics: string[];
  citations: Citation[];
  relatedTopics: string[];
  coverage: CoverageCase;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  retrievalMetadata: RetrievalMetadata;
  sources: Array<{
    chunkId: string;
    videoId: string;
    videoTitle?: string;
    startTime: number;
    endTime: number;
    excerpt: string;
    similarityScore: number;
  }>;
  model: string;
  tokensUsed?: number;
  /** @deprecated Use lectureContent */
  lectureAnswer?: string;
  /** @deprecated Use additionalExplanation + generalKnowledge */
  explanation?: string;
  /** @deprecated */
  keyPoints?: string[];
  /** @deprecated */
  confidenceScore?: number;
};

type ParsedModelJson = {
  summary: string;
  lectureContent: string;
  additionalExplanation: string;
  generalKnowledge: string;
  keyTakeaways: string[];
  suggestedRelatedTopics: string[];
};

function parseStructuredJson(raw: string, coverage: CoverageCase): ParsedModelJson {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const legacyExplanation = String(parsed.explanation ?? parsed.content ?? '').trim();
    const lectureContent = String(
      parsed.lectureContent ??
        parsed.lectureAnswer ??
        (coverage !== 'none' ? legacyExplanation : '')
    ).trim();
    const additionalExplanation = String(
      parsed.additionalExplanation ?? (coverage === 'partial' ? parsed.generalKnowledge ?? '' : '')
    ).trim();
    const generalKnowledge = String(
      parsed.generalKnowledge ?? (coverage === 'none' ? legacyExplanation : '')
    ).trim();

    return {
      summary: String(parsed.summary ?? '').trim(),
      lectureContent,
      additionalExplanation,
      generalKnowledge,
      keyTakeaways: Array.isArray(parsed.keyTakeaways)
        ? parsed.keyTakeaways.map(String).filter(Boolean)
        : Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.map(String).filter(Boolean)
          : [],
      suggestedRelatedTopics: Array.isArray(parsed.suggestedRelatedTopics)
        ? parsed.suggestedRelatedTopics.map(String).filter(Boolean)
        : Array.isArray(parsed.relatedTopics)
          ? parsed.relatedTopics.map(String).filter(Boolean)
          : [],
    };
  } catch {
    ragDevLog('structured-parse-failed', {
      coverage,
      contentPreview: trimmed.slice(0, 500),
    });
    return {
      summary: trimmed.slice(0, 280),
      lectureContent:
        coverage === 'none' ? 'The retrieved lecture context did not contain enough information.' : trimmed,
      additionalExplanation: '',
      generalKnowledge: coverage === 'none' ? trimmed : '',
      keyTakeaways: [],
      suggestedRelatedTopics: [],
    };
  }
}

export const chatStructuredService = {
   async send(params: {
    userId: string;
    question: string;
    videoId: string;
    videoTitle?: string;
    playlistId?: string;
    mode?: 'concise' | 'deep' | 'interview';
    language?: ResponseLanguageId;
    chunks: Parameters<typeof ragService.retrieve>[0]['chunks'];
    topK?: number;
  }): Promise<StructuredChatResponse> {
    const dedupeKey = `chat:${params.userId}:${params.videoId}:${params.question}:${params.mode ?? 'concise'}`;

    if (requestDeduplicator.hasPending(dedupeKey)) {
      ragDevLog('request-dedup', { key: dedupeKey, status: 'waiting' });
    }

    return requestDeduplicator.execute(dedupeKey, async () => {
      const language = normalizeLanguageId(params.language);
      const topK = params.topK ?? 14;

      const retrieved: ScoredChunkResult[] = await ragService.retrieve({
        userId: params.userId,
        videoId: params.videoId,
        question: params.question,
        chunks: params.chunks,
        topK,
        playlistId: params.playlistId,
      });

      const analysis = analyzeRetrieval(retrieved);
      const responseMode = coverageToMode(analysis.coverage);
      const { score: confidence, label: confidenceLabel } = computeConfidence(analysis);
      const lectureRelatedTopics = lectureRelatedTopicsFromRetrieval(retrieved);

      ragDevLog('structured-retrieval-analysis', {
        question: params.question,
        requestedTopK: topK,
        retrieved: retrieved.length,
        coverage: analysis.coverage,
        maxSimilarity: analysis.maxSimilarity,
        avgTopSimilarity: analysis.avgTopSimilarity,
        topChunkIds: analysis.topChunkIds,
        chunkScores: retrieved.slice(0, 8).map((r) => ({
          id: r.chunk.id,
          keyword: r.keywordSimilarity,
          semantic: r.semanticSimilarity,
          score: r.score,
        })),
      });

      const packedContexts: PackedContext[] = contextPackingService.pack(retrieved);
      const promptStart = Date.now();
      const context = packedContexts.map((p) => citationService.formatPackedContextLine(p)).join('\n\n');
      const { system, user } = promptBuilderService.buildStructuredChatPrompt({
        mode: params.mode ?? 'concise',
        language,
        coverage: analysis.coverage,
        question: params.question,
        videoTitle: params.videoTitle,
        videoId: params.videoId,
        context,
        lectureRelatedTopics,
      });
      const promptLatencyMs = Date.now() - promptStart;

      ragDevLog('prompt', {
        mode: responseMode,
        coverage: analysis.coverage,
        confidence,
        confidenceLabel,
        promptLengthChars: system.length + user.length,
        contextChunks: retrieved.length,
      });

const geminiStarted = Date.now();
      ragDevLog('gemini-request', {
        model: 'gemini-2.5-flash-lite',
        mode: params.mode ?? 'concise',
        temperature: 0.28,
        maxOutputTokens: params.mode === 'deep' ? 1400 : 1000,
      });
      let result;
      try {
        result = await withTimeout(
          geminiService.generateText({
            model: 'gemini-2.5-flash-lite',
            prompt: { system, user },
            config: {
              temperature: 0.28,
              maxOutputTokens: params.mode === 'deep' ? 1400 : 1000,
            },
          }),
          { timeoutMs: 15000, serviceName: 'gemini' }
        );
      } catch (error) {
        ragDevLog('gemini-failed', { error: String(error) });
        throw error;
      }
      const generationLatencyMs = Date.now() - geminiStarted;

      ragDevLog('gemini-response', {
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: generationLatencyMs,
        contentLength: result.content.length,
      });

      const parsed = parseStructuredJson(result.content, analysis.coverage);
      ragDevLog('structured-parse-success', {
        summaryLength: parsed.summary.length,
        lectureContentLength: parsed.lectureContent.length,
        additionalExplanationLength: parsed.additionalExplanation.length,
        generalKnowledgeLength: parsed.generalKnowledge.length,
        keyTakeaways: parsed.keyTakeaways.length,
      });
      const citations = citationService.buildCitations(
        retrieved.map((r) => ({ chunk: r.chunk, score: r.score }))
      );

      const sources = retrieved.map((r) => ({
        chunkId: r.chunk.id,
        videoId: r.chunk.videoId,
        videoTitle: r.chunk.videoTitle,
        startTime: r.chunk.startTime,
        endTime: r.chunk.endTime,
        excerpt: r.chunk.text.slice(0, 220).trim(),
        similarityScore: Math.max(r.semanticSimilarity, r.keywordSimilarity),
      }));

      const suggestedRelatedTopics =
        analysis.coverage === 'none'
          ? parsed.suggestedRelatedTopics
          : parsed.suggestedRelatedTopics.filter(
              (t) => !lectureRelatedTopics.some((l) => l.toLowerCase() === t.toLowerCase())
            );

      const retrievalMetadata: RetrievalMetadata = {
        coverage: analysis.coverage,
        confidenceLabel,
        maxSimilarity: analysis.maxSimilarity,
        avgTopSimilarity: analysis.avgTopSimilarity,
        chunkCount: analysis.chunkCount,
        topChunkIds: analysis.topChunkIds,
        promptLengthChars: system.length + user.length,
        geminiLatencyMs: generationLatencyMs,
      };

      return {
        mode: responseMode,
        summary: parsed.summary,
        lectureContent: parsed.lectureContent,
        additionalExplanation: parsed.additionalExplanation,
        generalKnowledge: parsed.generalKnowledge,
        keyTakeaways: parsed.keyTakeaways,
        lectureRelatedTopics,
        suggestedRelatedTopics,
        relatedTopics: [...lectureRelatedTopics, ...suggestedRelatedTopics],
        coverage: analysis.coverage,
        confidence,
        confidenceLabel,
        citations,
        sources,
        retrievalMetadata,
        model: result.model,
        tokensUsed: result.tokensUsed,
        lectureAnswer: parsed.lectureContent,
        explanation: [parsed.lectureContent, parsed.additionalExplanation, parsed.generalKnowledge]
          .filter(Boolean)
          .join('\n\n'),
        keyPoints: parsed.keyTakeaways,
        confidenceScore: confidence,
      };
    });
  },
};
