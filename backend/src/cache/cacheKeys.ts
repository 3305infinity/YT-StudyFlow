export type CacheKeyType = 'queryRewrite' | 'embedding' | 'retrieval' | 'packing';

export function makeQueryRewriteKey(query: string): string {
  return `qr:${query}`;
}

export function makeEmbeddingKey(query: string): string {
  return `emb:${query}`;
}

export function makeRetrievalKey(query: string, videoId: string, playlistId?: string): string {
  const playlist = playlistId ? `:${playlistId}` : '';
  return `ret:${videoId}${playlist}:${query}`;
}

export function makePackingKey(videoId: string, chunkIds: string[]): string {
  const sorted = [...chunkIds].sort();
  return `pack:${videoId}:${sorted.join(',')}`;
}

export function makeVideoInvalidationKey(videoId: string): string {
  return `video:${videoId}`;
}