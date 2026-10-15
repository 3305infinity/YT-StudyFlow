/**
 * Gemini is used for embeddings ONLY.
 *
 * All text generation — chat answers, notes, chapters, flashcards, quizzes, the study
 * agent and translation — runs on Groq via services/groq.service.ts. Do not add a
 * generateContent path back into this file.
 */

import { GEMINI_DEFAULTS, logDev } from './gemini.config.js';
import { assertOkResponse, geminiPost } from './gemini.http.js';
import {
  extractBatchEmbeddings,
  extractSingleEmbedding,
  parseJsonBody,
} from './gemini.parse.js';

export type EmbedInput = {
  model: string;
  input: string[];
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY';
};

export type EmbedOutput = {
  model: string;
  embeddings: number[][];
};

export const geminiService = {
  async embedTexts(input: EmbedInput): Promise<EmbedOutput> {
    const model = input.model || GEMINI_DEFAULTS.embeddingModel;
    const taskType = input.taskType ?? 'RETRIEVAL_DOCUMENT';
    const modelPath = `models/${model}`;
    const startTime = Date.now();

    logDev('embedTexts:init', {
      model,
      taskType,
      inputCount: input.input.length,
      totalChars: input.input.reduce((sum, text) => sum + text.length, 0),
    });

    let embeddings: number[][];

    if (input.input.length === 1) {
      const result = await geminiPost(`/models/${encodeURIComponent(model)}:embedContent`, {
        model: modelPath,
        content: { parts: [{ text: input.input[0] }] },
        taskType,
      });
      const text = assertOkResponse(result);
      const data = parseJsonBody<Record<string, unknown>>(text);
      embeddings = [extractSingleEmbedding(data)];
    } else {
      const result = await geminiPost(`/models/${encodeURIComponent(model)}:batchEmbedContents`, {
        requests: input.input.map((text) => ({
          model: modelPath,
          content: { parts: [{ text }] },
          taskType,
        })),
      });
      const text = assertOkResponse(result);
      const data = parseJsonBody<Record<string, unknown>>(text);
      embeddings = extractBatchEmbeddings(data, input.input.length);
    }

    const latencyMs = Date.now() - startTime;
    logDev('embedTexts', {
      model,
      dimensions: embeddings[0]?.length ?? 3072,
      inputCount: input.input.length,
      latencyMs,
      status: 'success',
    });

    return { model, embeddings };
  },

  /** Health of the embedding path — the only thing Gemini is used for. */
  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      const model = GEMINI_DEFAULTS.embeddingModel;
      const result = await geminiPost(`/models/${encodeURIComponent(model)}:embedContent`, {
        model: `models/${model}`,
        content: { parts: [{ text: 'health check' }] },
        taskType: 'RETRIEVAL_QUERY',
      });
      assertOkResponse(result);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - start,
      };
    }
  },
};

export { isRetryableGeminiError } from './gemini.errors.js';
