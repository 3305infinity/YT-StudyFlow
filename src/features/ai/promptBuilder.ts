import type { ResponseLanguageId } from '@lib/languages';
import { localization } from '@lib/localization.service';
import type { SemanticChunk, StudyLevel } from '@/types/ai';
import type { ResponseIntent } from './responseIntent';
import { intentInstructions } from './responseIntent';

export { languageInstruction, ENGLISH_OUTPUT_RULE } from '@lib/languages';
export { localization } from '@lib/localization.service';

export type PromptBuilderOptions = {
  mode: 'interview' | 'student' | 'default';
  includeTimestamps: boolean;
  maxContextChars: number;
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatChunk(chunk: SemanticChunk, includeTimestamps: boolean, index: number): string {
  const body = chunk.text.trim();
  const src = chunk.videoTitle
    ? `[Video: ${chunk.videoTitle}]`
    : chunk.videoId
      ? `[Video ${chunk.videoId}]`
      : '';
  if (!includeTimestamps) return `[${index}] ${src} ${body}`.trim();
  return `[${index}] ${src} (${formatTime(chunk.startTime)}-${formatTime(chunk.endTime)}) ${body}`.trim();
}

const TUTOR_SYSTEM = `You are YT StudyFlow, an experienced teacher helping a student learn from one YouTube lecture.

Use the retrieved transcript as the primary source. Do not copy transcript sentences verbatim; synthesize them into clear study material.
Explain concepts naturally, merge repeated ideas, remove filler speech, and preserve technical accuracy.
Add concise background, examples, or missing context when useful, but label it as background if it is not directly from the transcript.
Never return raw transcript snippets as the final answer. The answer should read like notes written by a human instructor.`;

export function buildEducationalPrompt(params: {
  userQuery: string;
  relevantChunks: SemanticChunk[];
  videoTitle?: string;
  promptOptions: PromptBuilderOptions;
  conversationSummary?: string;
  responseIntent: ResponseIntent;
  language?: ResponseLanguageId;
}): { system: string; user: string; contextChunks: SemanticChunk[] } {
  const { userQuery, relevantChunks, videoTitle, conversationSummary, responseIntent, promptOptions } =
    params;
  const langRule = localization.promptInstruction(params.language);
  const contextChunks = relevantChunks.filter((c) => c.text.trim());

  let context = '';
  const used: SemanticChunk[] = [];
  for (let i = 0; i < contextChunks.length; i++) {
    const c = contextChunks[i]!;
    const line = formatChunk(c, promptOptions.includeTimestamps, i + 1);
    const next = context ? `${context}\n\n${line}` : line;
    if (next.length > promptOptions.maxContextChars) break;
    context = next;
    used.push(c);
  }

  const formatBlock = intentInstructions(responseIntent, userQuery);

  return {
    system: [TUTOR_SYSTEM, langRule, formatBlock].join('\n\n'),
    user: [
      videoTitle ? `Video: ${videoTitle}` : '',
      conversationSummary ? `Recent conversation:\n${conversationSummary}` : '',
      `Student question: ${userQuery.trim()}`,
      '',
      'Retrieved transcript context:',
      context || '(no transcript chunks were retrieved)',
      '',
      'Write the final answer as polished study material. Use timestamps only as lightweight references, not as the structure of the answer.',
    ]
      .filter(Boolean)
      .join('\n'),
    contextChunks: used,
  };
}

function notesModeSpec(mode: string): string {
  switch (mode) {
    case 'interview':
      return [
        'Create interview-prep notes with 8-12 strong Q/A pairs.',
        'Questions should test conceptual understanding, edge cases, and practical application.',
        'Answers should synthesize transcript ideas first, then add brief background when helpful.',
      ].join(' ');
    case 'detailed':
      return [
        'Create detailed notes with clear sections, definitions, intuition, method/steps, examples, pitfalls, and takeaways.',
        'Merge repeated ideas and remove filler speech.',
      ].join(' ');
    case 'revision':
      return [
        'Create a compact revision sheet with core definitions, formulas/rules, common mistakes, and exam-style reminders.',
      ].join(' ');
    case 'implementation':
      return [
        'Create implementation notes with operations/API, pseudocode, a small code skeleton when relevant, complexity, and edge cases.',
      ].join(' ');
    case 'contest':
      return [
        'Create contest notes with problem patterns, when to use the technique, tricks, constraints, and practice prompts.',
      ].join(' ');
    case 'concise':
    default:
      return [
        'Create concise instructor-style notes covering the major concepts and their relationships.',
        'Do not simply list transcript lines.',
      ].join(' ');
  }
}

export function buildStudyPathPrompt(params: {
  topic: string;
  level: StudyLevel;
  videoTitle?: string;
  evidence: string;
  language?: ResponseLanguageId;
}): { system: string; user: string } {
  const levelGuide = {
    beginner:
      'Assume no prior knowledge. Start with intuition, define terms, and choose foundational segments.',
    intermediate:
      'Balance intuition and practice. Merge repeated segments and keep the path efficient.',
    advanced:
      'Skip basic motivation unless needed. Emphasize optimizations, proofs, complexity, and interview traps.',
  }[params.level];

  return {
    system: [
      localization.promptInstruction(params.language),
      'You are an expert course tutor building a personalized learning path from real transcript evidence.',
      'Use evidence timestamps exactly; do not invent startTime or endTime values.',
      'Merge adjacent evidence when it teaches the same concept.',
      'Add general knowledge only for prerequisites, interview questions, next topics, and quiz explanations.',
      'Return valid JSON only with no markdown fences:',
      '{"estimatedMinutes":number,"prerequisites":string[],"segments":[{"title":string,"description":string,"startTime":number,"endTime":number,"videoId":string}],"keyConcepts":string[],"interviewQuestions":string[],"conceptMap":[{"id":string,"label":string,"children":[{"id":string,"label":string}]}],"nextTopics":string[],"notesPreview":string,"quickQuiz":[{"id":string,"question":string,"options":string[4],"correctAnswer":number,"explanation":string}]}',
      'segments: 4-8 ordered lessons from the evidence.',
      'notesPreview: 3-5 lines of polished markdown notes.',
      'quickQuiz: exactly 3 MCQs testing understanding from the evidence.',
    ].join(' '),
    user: [
      `Topic to teach: ${params.topic}`,
      `Student level: ${params.level} - ${levelGuide}`,
      `Course: ${params.videoTitle ?? 'YouTube playlist'}`,
      '',
      'Retrieved transcript evidence:',
      params.evidence,
    ].join('\n'),
  };
}

export function buildNotesPrompt(params: {
  mode: string;
  videoTitle?: string;
  context: string;
  includeTimestamps: boolean;
  language?: ResponseLanguageId;
}): { system: string; user: string } {
  return {
    system: [
      'You generate high-quality study notes from lecture transcript context.',
      localization.promptInstruction(params.language),
      'Use the transcript as the primary source, but write like an instructor, not like captions.',
      'Identify major concepts, merge similar ideas, remove filler speech, simplify complex explanations, and preserve technical accuracy.',
      'Do not copy transcript sentences verbatim.',
      'Return valid JSON only: {"title":string,"content":string,"tags":string[]}.',
      'content must be polished markdown with useful headings, bullets, bold terms, and code blocks if relevant.',
      notesModeSpec(params.mode),
    ].join(' '),
    user: [
      `Video: ${params.videoTitle ?? 'Unknown'}`,
      `Timestamps in notes: ${params.includeTimestamps}`,
      '',
      'Transcript context:',
      params.context,
    ].join('\n'),
  };
}

export function buildChaptersPrompt(params: {
  videoTitle?: string;
  maxChapters: number;
  context: string;
  language?: ResponseLanguageId;
}): { system: string; user: string } {
  return {
    system: [
      'Generate semantic video chapters from transcript context.',
      localization.promptInstruction(params.language),
      'Group the lecture by major concepts, not by arbitrary transcript breaks.',
      'Chapter summaries should be concise educational notes that remove filler speech.',
      'Use only timestamps present in the transcript context.',
      'Return JSON only: {"chapters":[{"id":string,"title":string,"startTime":number,"endTime":number,"summary":string,"keyPoints":string[]}]}.',
      'Times are in seconds.',
    ].join(' '),
    user: [
      `Video: ${params.videoTitle ?? 'Unknown'}`,
      `Max chapters: ${params.maxChapters}`,
      '',
      'Transcript context:',
      params.context,
    ].join('\n'),
  };
}

export function buildFlashcardsPrompt(params: {
  videoTitle?: string;
  maxCards: number;
  context: string;
  language?: ResponseLanguageId;
}): { system: string; user: string } {
  return {
    system: [
      'Generate study flashcards from lecture transcript context.',
      localization.promptInstruction(params.language),
      'Focus on concepts, definitions, procedures, comparisons, and facts worth remembering.',
      'Do not ask about timestamps or wording from the transcript.',
      'Do not copy transcript sentences verbatim.',
      'Return JSON only: {"flashcards":[{"id":string,"front":string,"back":string,"difficulty":"easy"|"medium"|"hard"}]}.',
    ].join(' '),
    user: [
      `Topic: ${params.videoTitle ?? 'Lecture'}`,
      `Max cards: ${params.maxCards}`,
      '',
      'Transcript context:',
      params.context,
    ].join('\n'),
  };
}

export function buildQuizPrompt(params: {
  videoTitle?: string;
  maxQuestions: number;
  context: string;
  language?: ResponseLanguageId;
}): { system: string; user: string } {
  return {
    system: [
      'Generate multiple-choice quiz questions that test understanding of the lecture material.',
      localization.promptInstruction(params.language),
      'Questions should assess concepts, reasoning, procedures, and common misconceptions.',
      'Do not ask about timestamps, video structure, or exact transcript wording.',
      'Write plausible distractors that are related to the topic.',
      'Return JSON only: {"questions":[{"id":string,"question":string,"options":string[4],"correctAnswerIndex":number,"explanation":string,"difficulty":"easy"|"medium"|"hard"}]}.',
    ].join(' '),
    user: [
      `Topic: ${params.videoTitle ?? 'Lecture'}`,
      `Max questions: ${params.maxQuestions}`,
      '',
      'Transcript context:',
      params.context,
    ].join('\n'),
  };
}

function parseJson<T>(text: string): T | null {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export { parseJson };
