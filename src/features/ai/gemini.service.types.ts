export type GeminiEmbeddingsRequest = {
  model: string;
  input: string[];
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY';
};

export type GeminiEmbeddingsResponse = { model: string; embeddings: number[][] };

export type GeminiTextRequest = {
  model: string;
  prompt: { system?: string; user: string };
  config?: { temperature?: number; maxOutputTokens?: number };
};

export type GeminiTextResponse = {
  content: string;
  tokensUsed?: number;
  model: string;
};
