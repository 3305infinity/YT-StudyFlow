import { Pinecone } from '@pinecone-database/pinecone';

import { env } from '../config/env.js';

import { withRetry } from '../utils/retry.js';



let client: Pinecone | null = null;



function getClient(): Pinecone {

  if (!env.pineconeApiKey) {

    throw new Error('PINECONE_API_KEY is not configured');

  }

  if (!client) {

    client = new Pinecone({ apiKey: env.pineconeApiKey });

  }

  return client;

}



export function pineconeNamespace(userId: string, videoId: string): string {

  const prefix = env.pineconeNamespace ? `${env.pineconeNamespace}_` : '';

  return `${prefix}${userId}_${videoId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

}



export type VectorChunk = {

  id: string;

  text: string;

  startTime: number;

  endTime: number;

  videoId: string;

  videoTitle?: string;

  playlistId?: string;

  title?: string;

};



export type PineconeQueryFilter = {

  videoId?: string;

  playlistId?: string;

};



function buildMetadataFilter(filter?: PineconeQueryFilter): Record<string, unknown> | undefined {

  if (!filter) return undefined;

  const clauses: Record<string, unknown>[] = [];

  if (filter.videoId) clauses.push({ videoId: { $eq: filter.videoId } });

  if (filter.playlistId) clauses.push({ playlistId: { $eq: filter.playlistId } });

  if (!clauses.length) return undefined;

  if (clauses.length === 1) return clauses[0];

  return { $and: clauses };

}



export const pineconeService = {

  isEnabled(): boolean {

    return !!env.pineconeApiKey;

  },



  async upsertChunks(params: {

    userId: string;

    videoId: string;

    chunks: Array<VectorChunk & { embedding: number[] }>;

  }): Promise<void> {

    if (!params.chunks.length) return;



    await withRetry(async () => {

      const pc = getClient();

      const index = pc.index(env.pineconeIndex);

      const namespace = pineconeNamespace(params.userId, params.videoId);



      await index.namespace(namespace).upsert(

        params.chunks.map((c) => ({

          id: c.id,

          values: c.embedding,

          metadata: {

            text: c.text.slice(0, 1000),

            title: (c.title ?? c.videoTitle ?? '').slice(0, 200),

            startTime: c.startTime,

            endTime: c.endTime,

            videoId: c.videoId,

            videoTitle: c.videoTitle ?? '',

            playlistId: c.playlistId ?? '',

          },

        }))

      );

    }, { label: 'pinecone.upsert' });

  },



  async query(params: {

    userId: string;

    videoId: string;

    queryEmbedding: number[];

    topK: number;

    filter?: PineconeQueryFilter;

  }): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {

    return withRetry(async () => {

      const pc = getClient();

      const index = pc.index(env.pineconeIndex);

      const namespace = pineconeNamespace(params.userId, params.videoId);

      const result = await index.namespace(namespace).query({

        vector: params.queryEmbedding,

        topK: params.topK,

        includeMetadata: true,

        filter: buildMetadataFilter(params.filter),

      });



      return (result.matches ?? []).map((m) => ({

        id: m.id ?? '',

        score: m.score ?? 0,

        metadata: (m.metadata ?? {}) as Record<string, unknown>,

      }));

    }, { label: 'pinecone.query' });

  },



  async deleteVideo(userId: string, videoId: string): Promise<void> {

    const pc = getClient();

    const index = pc.index(env.pineconeIndex);

    const namespace = pineconeNamespace(userId, videoId);

    await index.namespace(namespace).deleteAll();

  },

};



export function assertPineconeConfigured(): void {

  if (!pineconeService.isEnabled()) {

    console.warn('[backend] PINECONE_API_KEY not set — vector search will use keyword fallback only');

  }

}

