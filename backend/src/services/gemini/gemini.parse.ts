import { emptyResponseError } from './gemini.errors.js';

export function extractText(data: Record<string, unknown>): string {
  const candidates = data.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  const parts = candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('').trim();
}

export function extractSingleEmbedding(data: Record<string, unknown>): number[] {
  const values =
    (data.embedding as { values?: number[] } | undefined)?.values ??
    ((data.embeddings as Array<{ values?: number[] }> | undefined)?.[0]?.values);
  if (!values?.length) throw emptyResponseError();
  return values.map(Number);
}

export function extractBatchEmbeddings(
  data: Record<string, unknown>,
  expectedCount: number
): number[][] {
  const raw =
    (data.embeddings as Array<{ values?: number[] }> | undefined) ??
    (data.responses as Array<{ embedding?: { values?: number[] } }> | undefined)?.map(
      (item) => item.embedding
    );
  const embeddings = (raw ?? [])
    .map((e) => e?.values?.map(Number))
    .filter((v): v is number[] => !!v?.length);

  if (embeddings.length !== expectedCount) {
    throw emptyResponseError();
  }
  return embeddings;
}

export function parseJsonBody<T extends Record<string, unknown>>(text: string): T {
  return JSON.parse(text) as T;
}
