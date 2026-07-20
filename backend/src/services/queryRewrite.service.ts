export type QueryRewriteResult = {
  original: string;
  rewritten: string;
  wasRewritten: boolean;
};

const FOLLOW_UP_PATTERNS = [
  { pattern: /^(explain|what is|what are|why|how|when|where)\s+this\b/i, template: (m: string) => `Explain the concept: ${m.trim().replace(/^(explain|what is|what are|why|how|when|where)\s+this\b/i, '').trim() || 'the previous concept in detail with examples.'}` },
  { pattern: /^(what|what's|what is)\s+happened\s+after/i, template: () => 'Explain the concept discussed immediately after the current transcript section.' },
  { pattern: /^(what|what's|what is)\s+happened\s+next/i, template: () => 'Explain what happens next in the lecture sequence.' },
  { pattern: /^(continue|go on|could you explain)/i, template: () => 'Explain the continuing topic with detailed examples and reasoning.' },
];

const EXPANSION_TEMPLATES: Record<string, string> = {
  hoare: 'Hoare Partition algorithm used in QuickSort with working, partition process, and example',
  partition: 'Partition algorithm in QuickSort and QuickSort partition schemes with detailed explanation',
  quicksort: 'QuickSort algorithm sorting mechanism partition process time complexity and example',
  binary: 'Binary Search time complexity including best case average case worst case and reasoning',
  search: 'Search algorithm binary search time complexity space complexity and implementation',
  merge: 'Merge Sort algorithm divide and conquer approach merge process time complexity',
  sort: 'Sorting algorithm comparison based time complexity and implementation details',
  graph: 'Graph algorithm explanation including vertices edges traversal BFS DFS',
  tree: 'Tree data structure binary tree traversal algorithms and complexity',
  hash: 'Hash table hash function collision resolution hashing techniques',
};

function isLikelyWellFormed(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 10) return false;
  const technicalIndicators = ['algorithm', 'complexity', 'implementation', 'example', 'time', 'space', 'explain', 'with', 'including', 'process', 'mechanism'];
  return technicalIndicators.some((ind) => trimmed.includes(ind)) || trimmed.split(/\s+/).length >= 4;
}

function applyFollowUpRewrite(query: string): string | null {
  const trimmed = query.trim();
  for (const { pattern, template } of FOLLOW_UP_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match) {
      return template(match[0]);
    }
  }
  return null;
}

function applyExpansionRewrite(query: string): string | null {
  const trimmed = query.trim().toLowerCase();
  const words = trimmed.split(/\s+/);
  for (const word of words) {
    if (word in EXPANSION_TEMPLATES) {
      return EXPANSION_TEMPLATES[word];
    }
  }
  return null;
}

export function rewriteQuery(query: string): QueryRewriteResult {
  if (!query || !query.trim()) {
    return { original: query, rewritten: query, wasRewritten: false };
  }

  if (isLikelyWellFormed(query)) {
    return { original: query, rewritten: query, wasRewritten: false };
  }

  const followUpRewrite = applyFollowUpRewrite(query);
  if (followUpRewrite) {
    return { original: query, rewritten: followUpRewrite, wasRewritten: true };
  }

  const expansionRewrite = applyExpansionRewrite(query);
  if (expansionRewrite) {
    return { original: query, rewritten: expansionRewrite, wasRewritten: true };
  }

  return { original: query, rewritten: query, wasRewritten: false };
}

export const queryRewriteService = {
  rewrite: rewriteQuery,
};