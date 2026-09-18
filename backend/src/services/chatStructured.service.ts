import type { ResponseLanguageId } from '../lib/languages.js';
import { normalizeLanguageId } from '../lib/languages.js';
import { ragService, type ScoredChunkResult } from './rag.service.js';
import { promptBuilderService, detectIntent, type Intent } from './promptBuilder.service.js';
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
import { runAnswerGenerationPipeline, type FormattedResponse } from './answerGeneration/pipeline.js';

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
  directAnswer?: string;
  summary: string;
  lectureContent: string;
  additionalExplanation: string;
  generalKnowledge: string;
  steps?: string[];
  technicalInsight?: string;
  applications?: string[];
  keyTakeaways: string[];
  sections?: Array<{
    title: string;
    content: string;
    type: 'explanation' | 'steps' | 'technical' | 'application' | 'recap';
    items?: string[];
  }>;
  lectureRelatedTopics: string[];
  suggestedRelatedTopics: string[];
  citations: Citation[];
  relatedTopics: string[];
  coverage: CoverageCase;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  confidenceDisplayLabel: string;
  confidenceReason: string;
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
  /** @deprecated Use directAnswer or lectureContent */
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

function toMarkdownList(items: unknown[]): string {
  return items.map((item) => `- ${String(item)}`).join('\n');
}

function parseExplainResponse(data: Record<string, unknown>): ParsedModelJson {
  const concept = String(data.concept ?? '').trim();
  const simpleExplanation = String(data.simpleExplanation ?? '').trim();
  const example = String(data.example ?? '').trim();
  const analogy = String(data.analogy ?? '').trim();

  return {
    summary: concept || 'Explanation',
    lectureContent: simpleExplanation,
    additionalExplanation: example,
    generalKnowledge: analogy,
    keyTakeaways: [simpleExplanation, example, analogy].filter(Boolean).map((s) => s.slice(0, 200)),
    suggestedRelatedTopics: [],
  };
}

function parseCompareResponse(data: Record<string, unknown>): ParsedModelJson {
  const comparison = Array.isArray(data.comparison) ? data.comparison : [];
  const aspects = comparison
    .map((item) => {
      const aspect = String((item as Record<string, unknown>).aspect ?? '').trim();
      const itemA = String((item as Record<string, unknown>).itemA ?? '').trim();
      const itemB = String((item as Record<string, unknown>).itemB ?? '').trim();
      const verdict = String((item as Record<string, unknown>).verdict ?? '').trim();
      if (!aspect) return '';
      return `**${aspect}**\n- Item A: ${itemA}\n- Item B: ${itemB}\n- Verdict: ${verdict}`;
    })
    .filter(Boolean);

  const keyTakeaways = comparison
    .map((item) => String((item as Record<string, unknown>).verdict ?? '').trim())
    .filter(Boolean);

  return {
    summary: `Comparison with ${comparison.length} aspects`,
    lectureContent: aspects.join('\n\n') || String(data.comparison ?? ''),
    additionalExplanation: '',
    generalKnowledge: '',
    keyTakeaways: keyTakeaways.length ? keyTakeaways : ['See comparison details above.'],
    suggestedRelatedTopics: [],
  };
}

function parseInterviewResponse(data: Record<string, unknown>): ParsedModelJson {
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const qaPairs = questions
    .map((q, idx) => {
      const question = String((q as Record<string, unknown>).question ?? '').trim();
      const answer = String((q as Record<string, unknown>).answer ?? '').trim();
      const followUp = String((q as Record<string, unknown>).followUp ?? '').trim();
      if (!question) return '';
      const parts = [`**Q${idx + 1}: ${question}**`, `A: ${answer}`];
      if (followUp) parts.push(`Follow-up: ${followUp}`);
      return parts.join('\n');
    })
    .filter(Boolean);

  return {
    summary: `${questions.length} interview questions with model answers`,
    lectureContent: qaPairs.join('\n\n'),
    additionalExplanation: '',
    generalKnowledge: '',
    keyTakeaways: questions.slice(0, 5).map((q, idx) => {
      const question = String((q as Record<string, unknown>).question ?? '').trim();
      return `Q${idx + 1}: ${question}`;
    }),
    suggestedRelatedTopics: [],
  };
}

function parseWalkthroughResponse(data: Record<string, unknown>): ParsedModelJson {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const stepTexts = steps
    .map((s, idx) => {
      const action = String((s as Record<string, unknown>).action ?? '').trim();
      const why = String((s as Record<string, unknown>).why ?? '').trim();
      const pitfall = String((s as Record<string, unknown>).pitfall ?? '').trim();
      if (!action) return '';
      const parts = [`**Step ${idx + 1}: ${action}**`];
      if (why) parts.push(`Why: ${why}`);
      if (pitfall) parts.push(`Pitfall: ${pitfall}`);
      return parts.join('\n');
    })
    .filter(Boolean);

  return {
    summary: `${steps.length}-step walkthrough`,
    lectureContent: stepTexts.join('\n\n'),
    additionalExplanation: '',
    generalKnowledge: '',
    keyTakeaways: steps.slice(0, 5).map((s, idx) => {
      const action = String((s as Record<string, unknown>).action ?? '').trim();
      return `Step ${idx + 1}: ${action}`;
    }),
    suggestedRelatedTopics: [],
  };
}

function parseNotesResponse(data: Record<string, unknown>): ParsedModelJson {
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const sectionTexts = sections
    .map((section) => {
      const heading = String((section as Record<string, unknown>).heading ?? '').trim();
      const bullets = Array.isArray((section as Record<string, unknown>).bullets)
        ? ((section as Record<string, unknown>).bullets as unknown[]).map((b) => String(b)).filter(Boolean)
        : [];
      if (!heading && !bullets.length) return '';
      const parts = [`**${heading}**`];
      if (bullets.length) parts.push(toMarkdownList(bullets));
      return parts.join('\n');
    })
    .filter(Boolean);

  const allBullets = sections
    .flatMap((section) => {
      const bullets = Array.isArray((section as Record<string, unknown>).bullets)
        ? ((section as Record<string, unknown>).bullets as unknown[]).map((b) => String(b)).filter(Boolean)
        : [];
      return bullets;
    })
    .slice(0, 5);

  return {
    summary: sections.length ? `Notes with ${sections.length} sections` : 'Study notes',
    lectureContent: sectionTexts.join('\n\n'),
    additionalExplanation: '',
    generalKnowledge: '',
    keyTakeaways: allBullets,
    suggestedRelatedTopics: [],
  };
}

function parseQuizResponse(data: Record<string, unknown>): ParsedModelJson {
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const questionTexts = questions
    .map((q, idx) => {
      const question = String((q as Record<string, unknown>).question ?? '').trim();
      const options = Array.isArray((q as Record<string, unknown>).options)
        ? ((q as Record<string, unknown>).options as unknown[]).map((o) => String(o)).filter(Boolean)
        : [];
      const correct = String((q as Record<string, unknown>).correct ?? '').trim();
      const explanation = String((q as Record<string, unknown>).explanation ?? '').trim();
      if (!question) return '';
      const parts = [`**Q${idx + 1}: ${question}**`];
      if (options.length) parts.push(options.join('\n'));
      parts.push(`Correct: ${correct}`);
      if (explanation) parts.push(`Explanation: ${explanation}`);
      return parts.join('\n');
    })
    .filter(Boolean);

  return {
    summary: `${questions.length} quiz questions`,
    lectureContent: questionTexts.join('\n\n'),
    additionalExplanation: '',
    generalKnowledge: '',
    keyTakeaways: questions.slice(0, 5).map((q, idx) => {
      const question = String((q as Record<string, unknown>).question ?? '').trim();
      const correct = String((q as Record<string, unknown>).correct ?? '').trim();
      return `Q${idx + 1}: ${question} (Correct: ${correct})`;
    }),
    suggestedRelatedTopics: [],
  };
}

function parseExamReviewResponse(data: Record<string, unknown>): ParsedModelJson {
  const topics = Array.isArray(data.topics) ? data.topics : [];
  const topicTexts = topics
    .map((t) => {
      const topic = String((t as Record<string, unknown>).topic ?? '').trim();
      const keyPoints = Array.isArray((t as Record<string, unknown>).keyPoints)
        ? ((t as Record<string, unknown>).keyPoints as unknown[]).map((p) => String(p)).filter(Boolean)
        : [];
      const formula = String((t as Record<string, unknown>).formula ?? '').trim();
      const pitfall = String((t as Record<string, unknown>).pitfall ?? '').trim();
      if (!topic && !keyPoints.length) return '';
      const parts = [`**${topic}**`];
      if (keyPoints.length) parts.push(toMarkdownList(keyPoints));
      if (formula) parts.push(`Formula: ${formula}`);
      if (pitfall) parts.push(`Pitfall: ${pitfall}`);
      return parts.join('\n');
    })
    .filter(Boolean);

  const allKeyPoints = topics
    .flatMap((t) => {
      const keyPoints = Array.isArray((t as Record<string, unknown>).keyPoints)
        ? ((t as Record<string, unknown>).keyPoints as unknown[]).map((p) => String(p)).filter(Boolean)
        : [];
      return keyPoints;
    })
    .slice(0, 5);

  return {
    summary: topics.length ? `Exam review with ${topics.length} topics` : 'Exam review',
    lectureContent: topicTexts.join('\n\n'),
    additionalExplanation: '',
    generalKnowledge: '',
    keyTakeaways: allKeyPoints,
    suggestedRelatedTopics: [],
  };
}

function parseIntentResponse(raw: string, intent: Intent, coverage: CoverageCase): ParsedModelJson {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;

    let result: ParsedModelJson;
    switch (intent) {
      case 'compare':
        result = parseCompareResponse(parsed);
        break;
      case 'interview':
        result = parseInterviewResponse(parsed);
        break;
      case 'walkthrough':
        result = parseWalkthroughResponse(parsed);
        break;
      case 'notes':
        result = parseNotesResponse(parsed);
        break;
      case 'quiz':
        result = parseQuizResponse(parsed);
        break;
      case 'exam-review':
        result = parseExamReviewResponse(parsed);
        break;
      case 'explain':
      default:
        result = parseExplainResponse(parsed);
        break;
    }

    ragDevLog('structured-parse-success', {
      intent,
      coverage,
      summaryLength: result.summary.length,
      lectureContentLength: result.lectureContent.length,
      additionalExplanationLength: result.additionalExplanation.length,
      generalKnowledgeLength: result.generalKnowledge.length,
      keyTakeaways: result.keyTakeaways.length,
    });

    return result;
  } catch {
    ragDevLog('structured-parse-failed', {
      intent,
      coverage,
      rawResponse: trimmed,
      contentPreview: trimmed.slice(0, 500),
    });
    return parseStructuredJson(trimmed, coverage);
  }
}

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
      rawResponse: trimmed,
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
      const topK = params.topK ?? 20;

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

      const chunksForPipeline = retrieved.map((r) => ({
        text: r.chunk.text,
        startTime: r.chunk.startTime,
        endTime: r.chunk.endTime,
      }));

      const pipelineStarted = Date.now();
      let formatted: FormattedResponse;
      try {
        formatted = await withTimeout(
          runAnswerGenerationPipeline({
            question: params.question,
            chunks: chunksForPipeline,
            mode: params.mode ?? 'concise',
            coverage: analysis.coverage,
            language,
          }),
          { timeoutMs: 60000, serviceName: 'answer-generation' }
        );
      } catch (error) {
        ragDevLog('pipeline-failed', { error: String(error) });
        throw error;
      }
      const pipelineLatencyMs = Date.now() - pipelineStarted;

      ragDevLog('intent-detected', {
        question: params.question,
        intent: formatted.intent,
        targetConcept: formatted.targetConcept,
      });

      const parsed: ParsedModelJson = {
        summary: formatted.summary,
        lectureContent: formatted.lectureContent,
        additionalExplanation: formatted.additionalExplanation,
        generalKnowledge: formatted.generalKnowledge,
        keyTakeaways: formatted.keyTakeaways,
        suggestedRelatedTopics: formatted.suggestedRelatedTopics,
      };

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
        promptLengthChars: 0,
        geminiLatencyMs: pipelineLatencyMs,
      };

      let confidenceDisplayLabel: string;
      let confidenceReason: string;

      if (analysis.coverage === 'strong' && confidence >= 0.7) {
        confidenceDisplayLabel = 'Based on lecture sources';
        confidenceReason = 'High transcript match — explanation is fully grounded in video lecture context.';
      } else if (analysis.coverage === 'partial' || (confidence >= 0.4 && confidence < 0.7)) {
        confidenceDisplayLabel = 'Partially supported by lecture';
        confidenceReason = 'Partial transcript match — grounded in lecture cues with supplementary general knowledge.';
      } else {
        confidenceDisplayLabel = 'General explanation';
        confidenceReason = 'The lecture does not provide enough detail for this question, so general educational knowledge was used.';
      }

      return {
        mode: responseMode,
        directAnswer: formatted.directAnswer,
        summary: formatted.directAnswer || formatted.summary,
        lectureContent: formatted.explanation || formatted.lectureContent,
        additionalExplanation: formatted.technicalInsight || formatted.additionalExplanation,
        generalKnowledge: formatted.generalKnowledge,
        steps: formatted.steps,
        technicalInsight: formatted.technicalInsight,
        applications: formatted.applications,
        keyTakeaways: formatted.keyTakeaways,
        sections: formatted.sections,
        lectureRelatedTopics,
        suggestedRelatedTopics,
        relatedTopics: [...lectureRelatedTopics, ...suggestedRelatedTopics],
        coverage: analysis.coverage,
        confidence,
        confidenceLabel,
        confidenceDisplayLabel,
        confidenceReason,
        citations,
        sources,
        retrievalMetadata,
        model: formatted.model,
        tokensUsed: formatted.tokensUsed,
        lectureAnswer: formatted.explanation || formatted.lectureContent,
        explanation: [formatted.directAnswer, formatted.explanation, formatted.technicalInsight]
          .filter(Boolean)
          .join('\n\n'),
        keyPoints: formatted.keyTakeaways,
        confidenceScore: confidence,
      };
    });
  },
};
