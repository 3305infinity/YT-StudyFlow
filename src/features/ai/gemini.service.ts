import { api, ApiClientError } from '@lib/api/client';
import { friendlyAiError, logDevAiError } from '@lib/aiErrors';
import type { GeminiEmbeddingsRequest, GeminiEmbeddingsResponse, GeminiTextRequest, GeminiTextResponse } from './gemini.service.types';

export type { GeminiEmbeddingsRequest, GeminiEmbeddingsResponse, GeminiTextRequest, GeminiTextResponse };

function wrapAiError(e: unknown, context: string): Error {
  logDevAiError(context, e);
  if (e instanceof ApiClientError) {
    const err = new Error(friendlyAiError(e));
    err.name = 'AiServiceError';
    return err;
  }
  return e instanceof Error ? e : new Error(friendlyAiError(e));
}

export class BackendAiService {
  async generateText(req: GeminiTextRequest): Promise<GeminiTextResponse> {
    if (!req.prompt.user?.trim()) {
      throw new Error('Prompt is empty');
    }
    try {
      return await api.post<GeminiTextResponse>('/api/ai/generate', req);
    } catch (e) {
      throw wrapAiError(e, 'generateText');
    }
  }

  async embedTexts(req: GeminiEmbeddingsRequest): Promise<GeminiEmbeddingsResponse> {
    if (!req.input.length) {
      throw new Error('Nothing to embed');
    }
    try {
      return await api.post<GeminiEmbeddingsResponse>('/api/ai/embed', req);
    } catch (e) {
      throw wrapAiError(e, 'embedTexts');
    }
  }
}

export async function createGeminiService(): Promise<BackendAiService> {
  return new BackendAiService();
}

export type GeminiService = BackendAiService;
