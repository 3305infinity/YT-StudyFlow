import { GEMINI, VECTOR_SEARCH } from '@lib/constants';
import type { AIResponse, ChatCitation, SemanticChunk } from '@/types/ai';
import type {
  ChatSource,
  ConfidenceLabel,
  CoverageCase,
  RetrievalMetadata,
  StructuredChatPayload,
} from '@/types/chat';
import { STRUCTURE_SECTIONS } from '@/types/chat';
import { localChatAnswer } from '@/features/ai/localGeneration';
import { canUseGeminiApi } from '@lib/storage';
import { useChatStore } from './chat.store';
import { cacheChatMessage } from '@/lib/sync/history.sync';
import { scheduleSync } from '@/lib/sync/engine';
import { api } from '@lib/api/client';
import { usePipelineStore } from '@/store/pipeline.store';
import { friendlyAiError, isGeminiQuotaError } from '@lib/aiErrors';
import { getSettings } from '@lib/storage';

export type ChatMode = 'concise' | 'deep' | 'interview';

type StructuredApiResponse = {
  mode: 'lecture-grounded' | 'hybrid' | 'general-knowledge';
  summary: string;
  lectureContent: string;
  additionalExplanation: string;
  generalKnowledge: string;
  keyTakeaways: string[];
  lectureRelatedTopics: string[];
  suggestedRelatedTopics: string[];
  coverage: CoverageCase;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  citations: ChatCitation[];
  sources: ChatSource[];
  retrievalMetadata: RetrievalMetadata;
  model: string;
  tokensUsed?: number;
  /** @deprecated */
  lectureAnswer?: string;
  explanation?: string;
  keyPoints?: string[];
  confidenceScore?: number;
};

function toApiChunks(chunks: SemanticChunk[]) {
  return chunks.map((c) => ({
    id: c.id,
    text: c.text,
    startTime: c.startTime,
    endTime: c.endTime,
    videoId: c.videoId ?? '',
    videoTitle: c.videoTitle,
    playlistId: c.playlistId,
  }));
}

function mapApiResponse(response: StructuredApiResponse): {
  structured: StructuredChatPayload;
  content: string;
} {
  const lectureContent = response.lectureContent ?? response.lectureAnswer ?? '';
  const additionalExplanation = response.additionalExplanation ?? '';
  const generalKnowledge = response.generalKnowledge ?? '';

  const structured: StructuredChatPayload = {
    mode: response.mode ?? 'hybrid',
    summary: response.summary,
    lectureContent,
    additionalExplanation,
    generalKnowledge,
    keyTakeaways: response.keyTakeaways ?? response.keyPoints ?? [],
    lectureRelatedTopics: response.lectureRelatedTopics ?? [],
    suggestedRelatedTopics: response.suggestedRelatedTopics ?? [],
    coverage: response.coverage ?? 'partial',
    confidence: response.confidence ?? response.confidenceScore ?? 0.5,
    confidenceLabel: response.confidenceLabel ?? 'medium',
  };

  const content =
    response.summary ||
    lectureContent ||
    additionalExplanation ||
    generalKnowledge ||
    response.explanation ||
    'No response generated.';

  return { structured, content };
}

async function persistLatestMessages(videoId: string): Promise<void> {
  const messages = useChatStore.getState().messages.slice(-2);
  for (const message of messages) {
    if (message.content.trim()) {
      await cacheChatMessage(videoId, message);
    }
  }
  scheduleSync();
}

async function revealSectionsProgressively(
  assistantId: string,
  requestId: number
): Promise<void> {
  const store = useChatStore.getState();
  const pipeline = usePipelineStore.getState();

  for (const section of STRUCTURE_SECTIONS) {
    if (!store.isActiveRequest(requestId)) return;
    await new Promise((r) => setTimeout(r, section === 'summary' ? 80 : 100));
    if (!store.isActiveRequest(requestId)) return;
    store.revealSection(assistantId, section, requestId);
    pipeline.setStage('rendering-citations');
  }

  if (!store.isActiveRequest(requestId)) return;
  pipeline.setStage('complete');
  setTimeout(() => {
    if (useChatStore.getState().isActiveRequest(requestId)) {
      usePipelineStore.getState().reset();
    }
  }, 500);
}

function deliverLocalStructured(
  assistantId: string,
  requestId: number,
  question: string,
  chunks: SemanticChunk[],
  videoTitle: string | undefined,
  mode: ChatMode,
  videoId: string
): AIResponse {
  const local = localChatAnswer(question, chunks, videoTitle, mode);
  const structured: StructuredChatPayload = {
    mode: chunks.length ? 'hybrid' : 'general-knowledge',
    summary: local.content.slice(0, 240),
    lectureContent: local.content,
    additionalExplanation: '',
    generalKnowledge: '',
    keyTakeaways: local.content.split('\n').filter((l) => l.trim().startsWith('-')).slice(0, 5),
    lectureRelatedTopics: [],
    suggestedRelatedTopics: [],
    coverage: chunks.length ? 'partial' : 'none',
    confidence: 0.35,
    confidenceLabel: 'low',
  };

  useChatStore.getState().finalizeStructured(
    assistantId,
    { content: local.content, structured, citations: [] },
    requestId
  );
  usePipelineStore.getState().reset();
  void revealSectionsProgressively(assistantId, requestId);
  void persistLatestMessages(videoId);
  return { content: local.content, relevantChunks: local.chunks, model: 'local-transcript' };
}

export async function sendChatMessage(params: {
  question: string;
  videoId: string;
  videoTitle?: string;
  semanticChunks: SemanticChunk[];
  mode?: ChatMode;
  playlistId?: string;
}): Promise<AIResponse> {
  const question = params.question.trim();
  if (!question) throw new Error('Enter a question');

  const mode = params.mode ?? 'concise';
  const pipeline = usePipelineStore.getState();
  const store = useChatStore.getState();
  const requestId = store.beginRequest();

  store.addUserMessage(question);
  const assistantId = store.addAssistantPlaceholder();

  pipeline.reset();
  pipeline.setStage('searching-knowledge');

  if (!(await canUseGeminiApi())) {
    return deliverLocalStructured(
      assistantId,
      requestId,
      question,
      params.semanticChunks,
      params.videoTitle,
      mode,
      params.videoId
    );
  }

  try {
    if (!store.isActiveRequest(requestId)) {
      throw new Error('Request superseded');
    }

    pipeline.setStage('generating-response');
    const settings = await getSettings();

    const response = await api.post<StructuredApiResponse>('/api/chat/structured', {
      question,
      videoId: params.videoId,
      videoTitle: params.videoTitle,
      playlistId: params.playlistId,
      mode,
      language: settings.responseLanguage,
      chunks: toApiChunks(params.semanticChunks),
      topK: VECTOR_SEARCH.CHAT_TOP_K,
    });

    if (!store.isActiveRequest(requestId)) {
      throw new Error('Request superseded');
    }

    const { structured, content } = mapApiResponse(response);

    store.finalizeStructured(
      assistantId,
      {
        content,
        structured,
        citations: response.citations,
        sources: response.sources,
        retrievalMetadata: response.retrievalMetadata,
      },
      requestId
    );

    void persistLatestMessages(params.videoId);
    await revealSectionsProgressively(assistantId, requestId);

    return {
      content,
      relevantChunks: params.semanticChunks,
      tokensUsed: response.tokensUsed,
      model: response.model ?? GEMINI.CHAT_MODEL,
    };
  } catch (e) {
    if (!store.isActiveRequest(requestId)) {
      throw e;
    }

    const msg = friendlyAiError(e);

    if (isGeminiQuotaError(e)) {
      return deliverLocalStructured(
        assistantId,
        requestId,
        question,
        params.semanticChunks,
        params.videoTitle,
        mode,
        params.videoId
      );
    }

    pipeline.reset();
    store.failRequest(requestId, assistantId, msg);
    throw e;
  }
}
