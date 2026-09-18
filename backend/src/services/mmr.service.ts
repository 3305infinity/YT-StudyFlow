import type { VectorChunk } from './pinecone.service.js';
import { cosineSimilarity } from '../utils/vector.js';

export type MMRCandidate = {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  values?: number[];
};

export type MMRResult = {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  values?: number[];
};

export type MMRConfig = {
  lambda: number;
  candidateK: number;
  finalK: number;
};

const DEFAULT_CONFIG: Required<MMRConfig> = {
  lambda: 0.7,
  candidateK: 40,
  finalK: 10,
};

export function mmr(
  queryEmbedding: number[],
  candidates: MMRCandidate[],
  config?: Partial<MMRConfig>
): MMRResult[] {
  const cfg: Required<MMRConfig> = {
    lambda: config?.lambda ?? DEFAULT_CONFIG.lambda,
    candidateK: config?.candidateK ?? DEFAULT_CONFIG.candidateK,
    finalK: config?.finalK ?? DEFAULT_CONFIG.finalK,
  };

  const selected: MMRResult[] = [];
  const remaining = [...candidates];

  const queryNorm = queryEmbedding;

  while (selected.length < cfg.finalK && remaining.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      const querySim = candidate.values
        ? cosineSimilarity(queryNorm, candidate.values)
        : candidate.score;

      let maxSimToSelected = 0;
      if (candidate.values) {
        for (const s of selected) {
          if (s.values) {
            const sim = cosineSimilarity(candidate.values, s.values);
            if (sim > maxSimToSelected) {
              maxSimToSelected = sim;
            }
          }
        }
      }

      const mmrScore = cfg.lambda * querySim - (1 - cfg.lambda) * maxSimToSelected;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) {
      break;
    }

    const best = remaining.splice(bestIdx, 1)[0];
    if (best) {
      selected.push({
        id: best.id,
        score: best.score,
        metadata: best.metadata,
        values: best.values,
      });
    }
  }

  return selected;
}

export function mmrWithChunks(
  queryEmbedding: number[],
  chunks: VectorChunk[],
  config?: Partial<MMRConfig>
): VectorChunk[] {
  const candidates: MMRCandidate[] = chunks.map((c) => ({
    id: c.id,
    score: 0,
    metadata: {
      text: c.text,
      startTime: c.startTime,
      endTime: c.endTime,
      videoId: c.videoId,
      title: c.title ?? '',
      videoTitle: c.videoTitle ?? '',
      playlistId: c.playlistId ?? '',
    },
  }));

  const results = mmr(queryEmbedding, candidates, config);

  return results.map((r) => ({
    id: r.id,
    text: r.metadata.text as string,
    startTime: r.metadata.startTime as number,
    endTime: r.metadata.endTime as number,
    videoId: r.metadata.videoId as string,
    title: r.metadata.title as string | undefined,
    videoTitle: r.metadata.videoTitle as string | undefined,
    playlistId: r.metadata.playlistId as string | undefined,
  }));
}