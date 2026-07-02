import type { ChatMode } from '@/features/chat/chat.service';

export type ResponseIntent = 'summary' | 'bullets' | 'interview' | 'explain';

const SUMMARY_RE =
  /\b(summarize|summary|main points|key points|tl;dr|overview|recap|in a nutshell)\b/i;
const BULLET_RE = /\b(\d+)\s*(bullet|point)s?\b|\bbullet\s*points?\b/i;
const INTERVIEW_RE = /\b(interview|mock interview|q\s*&\s*a|qa prep)\b/i;

export function detectResponseIntent(query: string, uiMode: ChatMode): ResponseIntent {
  const q = query.trim();

  if (SUMMARY_RE.test(q) || BULLET_RE.test(q)) {
    if (BULLET_RE.test(q) || /\bbullet/i.test(q)) return 'bullets';
    return 'summary';
  }

  if (uiMode === 'interview' || INTERVIEW_RE.test(q)) {
    return 'interview';
  }

  return 'explain';
}

export function bulletCountFromQuery(query: string): number | null {
  const m = query.match(/\b(\d+)\s*(?:bullet|point)s?\b/i);
  if (m) return Math.min(12, Math.max(3, parseInt(m[1]!, 10)));
  if (/\b(five|5)\b/i.test(query) && /bullet|point/i.test(query)) return 5;
  return null;
}

export function intentInstructions(intent: ResponseIntent, query: string): string {
  const n = bulletCountFromQuery(query);

  switch (intent) {
    case 'bullets':
      return [
        'FORMAT - Bullet study notes:',
        `- Write exactly ${n ?? 5} markdown bullets.`,
        '- Each bullet should capture one major concept or useful takeaway, not one transcript line.',
        '- Merge similar ideas, remove filler, and explain terms briefly when needed.',
        '- Start with one sentence stating what the lecture section is about.',
      ].join('\n');
    case 'summary':
      return [
        'FORMAT - Educational summary:',
        '- Write 1 concise overview paragraph plus 4-6 bullets, or one tight paragraph if the question asks for brevity.',
        '- Identify major concepts, merge repeated ideas, and remove filler speech.',
        '- The result should feel like notes from a human instructor.',
      ].join('\n');
    case 'interview':
      return [
        'FORMAT - Interview prep:',
        '- Write 4-6 strong **Q:** / **A:** pairs only when interview prep is requested.',
        '- Answers should synthesize transcript-backed concepts first, then add brief Background when useful.',
      ].join('\n');
    case 'explain':
    default:
      return [
        'FORMAT - Direct explanation:',
        '- Lead with the answer in 1-3 clear sentences.',
        '- Then use short sections or bullets for intuition, steps, examples, and key takeaways.',
      ].join('\n');
  }
}
