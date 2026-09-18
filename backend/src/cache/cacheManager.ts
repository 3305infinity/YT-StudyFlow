import { LruCache } from './lruCache.js';
import type { PackedContext } from '../services/contextPacking.service.js';
import {
  makeQueryRewriteKey,
  makeEmbeddingKey,
  makeRetrievalKey,
  makePackingKey,
} from './cacheKeys.js';

export type CacheTTLConfig = {
  queryRewriteTtlMs: number;
  embeddingTtlMs: number;
  retrievalTtlMs: number;
  packingTtlMs: number;
};

const DEFAULT_TTL_CONFIG: CacheTTLConfig = {
  queryRewriteTtlMs: 15 * 60 * 1000,
  embeddingTtlMs: 60 * 60 * 1000,
  retrievalTtlMs: 15 * 60 * 1000,
  packingTtlMs: 15 * 60 * 1000,
};

const DEFAULT_CACHE_SIZE = 1000;

export type CacheStats = {
  hits: { queryRewrite: number; embedding: number; retrieval: number; packing: number };
  misses: { queryRewrite: number; embedding: number; retrieval: number; packing: number };
  sizes: { queryRewrite: number; embedding: number; retrieval: number; packing: number };
};

export type RetrievalResult = {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  values?: number[];
};

export class CacheManager {
  private queryRewriteCache: LruCache<string>;
  private embeddingCache: LruCache<number[]>;
  private retrievalCache: LruCache<RetrievalResult[]>;
  private packingCache: LruCache<string>;

  private stats: CacheStats = {
    hits: { queryRewrite: 0, embedding: 0, retrieval: 0, packing: 0 },
    misses: { queryRewrite: 0, embedding: 0, retrieval: 0, packing: 0 },
    sizes: { queryRewrite: 0, embedding: 0, retrieval: 0, packing: 0 },
  };

  private enabled: boolean;
  private ttlConfig: CacheTTLConfig;

  constructor(config?: Partial<CacheTTLConfig> & { enabled?: boolean; cacheSize?: number }) {
    this.enabled = config?.enabled ?? true;
    this.ttlConfig = { ...DEFAULT_TTL_CONFIG, ...config };

    const cacheSize = config?.cacheSize ?? DEFAULT_CACHE_SIZE;
    this.queryRewriteCache = new LruCache<string>(cacheSize);
    this.embeddingCache = new LruCache<number[]>(cacheSize);
    this.retrievalCache = new LruCache<RetrievalResult[]>(cacheSize);
    this.packingCache = new LruCache<string>(cacheSize);
  }

  getQueryRewrite(query: string): { value: string | null; hit: boolean } {
    if (!this.enabled) return { value: null, hit: false };

    const key = makeQueryRewriteKey(query);
    const value = this.queryRewriteCache.get(key);

    if (value !== null) {
      this.stats.hits.queryRewrite++;
      return { value, hit: true };
    }

    this.stats.misses.queryRewrite++;
    return { value: null, hit: false };
  }

  setQueryRewrite(query: string, rewritten: string): void {
    if (!this.enabled) return;

    const key = makeQueryRewriteKey(query);
    this.queryRewriteCache.put(key, rewritten, this.ttlConfig.queryRewriteTtlMs);
    this.updateCacheSizes();
  }

  getEmbedding(query: string): { value: number[] | null; hit: boolean } {
    if (!this.enabled) return { value: null, hit: false };

    const key = makeEmbeddingKey(query);
    const value = this.embeddingCache.get(key);

    if (value !== null) {
      this.stats.hits.embedding++;
      return { value, hit: true };
    }

    this.stats.misses.embedding++;
    return { value: null, hit: false };
  }

  setEmbedding(query: string, embedding: number[]): void {
    if (!this.enabled) return;

    const key = makeEmbeddingKey(query);
    this.embeddingCache.put(key, embedding, this.ttlConfig.embeddingTtlMs);
    this.updateCacheSizes();
  }

  getRetrieval(query: string, videoId: string, playlistId?: string): {
    value: RetrievalResult[] | null;
    hit: boolean;
  } {
    if (!this.enabled) return { value: null, hit: false };

    const key = makeRetrievalKey(query, videoId, playlistId);
    const cached = this.retrievalCache.get(key);

    if (cached !== null) {
      this.stats.hits.retrieval++;
      return { value: cached, hit: true };
    }

    this.stats.misses.retrieval++;
    return { value: null, hit: false };
  }

  setRetrieval(
    query: string,
    videoId: string,
    results: RetrievalResult[],
    playlistId?: string
  ): void {
    if (!this.enabled) return;

    const key = makeRetrievalKey(query, videoId, playlistId);
    this.retrievalCache.put(key, results, this.ttlConfig.retrievalTtlMs);
    this.updateCacheSizes();
  }

  getPacking(videoId: string, chunkIds: string[]): { value: PackedContext[] | null; hit: boolean } {
    if (!this.enabled) return { value: null, hit: false };

    const key = makePackingKey(videoId, chunkIds);
    const value = this.packingCache.get(key);

    if (value !== null) {
      this.stats.hits.packing++;
      return { value: JSON.parse(value), hit: true };
    }

    this.stats.misses.packing++;
    return { value: null, hit: false };
  }

  setPacking(videoId: string, chunkIds: string[], packedContext: PackedContext[]): void {
    if (!this.enabled) return;

    const key = makePackingKey(videoId, chunkIds);
    this.packingCache.put(key, JSON.stringify(packedContext), this.ttlConfig.packingTtlMs);
    this.updateCacheSizes();
  }

  invalidateVideo(videoId: string): void {
    if (!this.enabled) return;

    const retrievalKeysToDelete: string[] = [];
    const packingKeysToDelete: string[] = [];

    for (const key of (this.retrievalCache as unknown as { cache: Map<string, unknown> }).cache.keys()) {
      if (key.startsWith(`ret:${videoId}:`)) {
        retrievalKeysToDelete.push(key);
      }
    }

    for (const key of (this.packingCache as unknown as { cache: Map<string, unknown> }).cache.keys()) {
      if (key.startsWith(`pack:${videoId}:`)) {
        packingKeysToDelete.push(key);
      }
    }

    for (const key of retrievalKeysToDelete) {
      this.retrievalCache.delete(key);
    }
    for (const key of packingKeysToDelete) {
      this.packingCache.delete(key);
    }

    this.updateCacheSizes();
  }

  clear(): void {
    this.queryRewriteCache.clear();
    this.embeddingCache.clear();
    this.retrievalCache.clear();
    this.packingCache.clear();
    this.resetStats();
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: { queryRewrite: 0, embedding: 0, retrieval: 0, packing: 0 },
      misses: { queryRewrite: 0, embedding: 0, retrieval: 0, packing: 0 },
      sizes: { queryRewrite: 0, embedding: 0, retrieval: 0, packing: 0 },
    };
  }

  private updateCacheSizes(): void {
    this.stats.sizes = {
      queryRewrite: this.queryRewriteCache.size,
      embedding: this.embeddingCache.size,
      retrieval: this.retrievalCache.size,
      packing: this.packingCache.size,
    };
  }
}

let globalCache: CacheManager | null = null;

export function getCacheManager(config?: Parameters<typeof CacheManager>[0]): CacheManager {
  if (!globalCache) {
    globalCache = new CacheManager(config);
  }
  return globalCache;
}

export const cacheManager = getCacheManager();