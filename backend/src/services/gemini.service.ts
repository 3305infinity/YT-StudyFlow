/**
 * Re-export for existing import paths.
 *
 * Gemini provides embeddings only. For text generation import `groqService` from
 * './groq.service.js'.
 */
export {
  geminiService,
  isRetryableGeminiError,
  type EmbedInput,
  type EmbedOutput,
} from './gemini/gemini.service.js';
