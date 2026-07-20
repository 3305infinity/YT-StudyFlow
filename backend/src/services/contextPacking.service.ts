import type { SemanticChunkInput } from './retrieval.service.js';

export type PackedContext = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  videoId: string;
  videoTitle?: string;
  playlistId?: string;
  chunkIds: string[];
  tokenCount: number;
};

export type ContextPackingConfig = {
  maxTokens: number;
  maxGapSeconds: number;
};

const DEFAULT_CONFIG: Required<ContextPackingConfig> = {
  maxTokens: 6000,
  maxGapSeconds: 5,
};

function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/);
  return Math.ceil(words.length * 1.3);
}

function canMerge(
  chunkA: { startTime: number; endTime: number },
  chunkB: { startTime: number; endTime: number },
  gapSeconds: number
): boolean {
  return chunkB.startTime <= chunkA.endTime + gapSeconds;
}

export function contextPacking(
  chunks: Array<{ chunk: SemanticChunkInput; score: number }>,
  config?: Partial<ContextPackingConfig>
): PackedContext[] {
  const cfg: Required<ContextPackingConfig> = {
    maxTokens: config?.maxTokens ?? DEFAULT_CONFIG.maxTokens,
    maxGapSeconds: config?.maxGapSeconds ?? DEFAULT_CONFIG.maxGapSeconds,
  };

  if (!chunks.length) return [];

  const sortedChunks = [...chunks].sort((a, b) => a.chunk.startTime - b.chunk.startTime);

  const packed: PackedContext[] = [];
  let currentPacked: PackedContext | null = null;

  for (const result of sortedChunks) {
    const chunk = result.chunk;
    const chunkTokens = estimateTokens(chunk.text);

    if (!currentPacked) {
      currentPacked = {
        id: chunk.id,
        text: chunk.text,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        videoId: chunk.videoId,
        videoTitle: chunk.videoTitle,
        playlistId: chunk.playlistId,
        chunkIds: [chunk.id],
        tokenCount: chunkTokens,
      };
      continue;
    }

    if (
      canMerge(
        { startTime: currentPacked.startTime, endTime: currentPacked.endTime },
        { startTime: chunk.startTime, endTime: chunk.endTime },
        cfg.maxGapSeconds
      )
    ) {
      const mergedTokens = estimateTokens(currentPacked.text + ' ' + chunk.text);

      if (mergedTokens <= cfg.maxTokens) {
        currentPacked = {
          id: currentPacked.id,
          text: currentPacked.text + ' ' + chunk.text,
          startTime: currentPacked.startTime,
          endTime: chunk.endTime,
          videoId: currentPacked.videoId,
          videoTitle: currentPacked.videoTitle,
          playlistId: currentPacked.playlistId,
          chunkIds: [...currentPacked.chunkIds, chunk.id],
          tokenCount: mergedTokens,
        };
      } else {
        packed.push(currentPacked);
        currentPacked = {
          id: chunk.id,
          text: chunk.text,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          videoId: chunk.videoId,
          videoTitle: chunk.videoTitle,
          playlistId: chunk.playlistId,
          chunkIds: [chunk.id],
          tokenCount: chunkTokens,
        };
      }
    } else {
      packed.push(currentPacked);
      currentPacked = {
        id: chunk.id,
        text: chunk.text,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        videoId: chunk.videoId,
        videoTitle: chunk.videoTitle,
        playlistId: chunk.playlistId,
        chunkIds: [chunk.id],
        tokenCount: chunkTokens,
      };
    }
  }

  if (currentPacked) {
    packed.push(currentPacked);
  }

  return packed;
}

export const contextPackingService = {
  pack: contextPacking,
};