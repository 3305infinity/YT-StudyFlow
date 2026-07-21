import type { ResponseLanguageId } from '../lib/languages.js';
import { localization } from '../lib/localization.service.js';
import type { CoverageCase } from './rag/coverage.js';
import { coverageToMode, modeInstructions } from './rag/responseMode.js';
import type { SemanticChunkInput } from './retrieval.service.js';
import { citationService } from './citation.service.js';

export type ChatMode = 'concise' | 'deep' | 'interview';

export type Intent = 'explain' | 'compare' | 'interview' | 'walkthrough' | 'notes' | 'quiz' | 'exam-review';

export function detectIntent(question: string): Intent {
  const q = question.toLowerCase();
  if (/\b(quiz|mcq|multiple choice|question bank|practice question|test me)\b/.test(q)) return 'quiz';
  if (/\b(exam review|revision|revise|study guide|comprehensive|full review|prepare for exam|midterm|final)\b/.test(q)) return 'exam-review';
  if (/\b(compare|difference|versus|vs|similarities|differences|contrast|distinguish|trade-off)\b/.test(q)) return 'compare';
  if (/\b(interview|prepare|questions|ask|answer|exam|test|placement|coding question|faang|behavioral)\b/.test(q)) return 'interview';
  if (/\b(walkthrough|step by step|step-by-step|how to|tutorial|guide|procedure|process|implement|build|create|setup|deploy)\b/.test(q)) return 'walkthrough';
  if (/\b(notes|summary|summarize|key points|recap|overview|brief|outline|bullet)\b/.test(q)) return 'notes';
  return 'explain';
}

function intentInstructions(intent: Intent): string {
  switch (intent) {
    case 'compare':
      return 'INTENT: COMPARE. Create a structured side-by-side comparison. Cover: (1) what each concept is, (2) how they differ, (3) when to use each, (4) trade-offs. Use labeled comparison sections.';
    case 'interview':
      return 'INTENT: INTERVIEW. Act as an interviewer. Provide 5-8 likely exam/interview questions based on the lecture, with detailed model answers. Include follow-up questions that test deeper understanding. Format as Q&A pairs.';
    case 'walkthrough':
      return 'INTENT: WALKTHROUGH. Provide a numbered step-by-step guide. Explain what happens at each stage, why it matters, and what to watch out for. Include prerequisites and common pitfalls.';
    case 'notes':
      return 'INTENT: NOTES. Create structured study notes. Use clear headings, bullet points, and bold key terms. Make it scannable for quick review. This is the only mode where a summary-style answer is appropriate.';
    case 'quiz':
      return 'INTENT: QUIZ. Generate 5-10 multiple-choice questions based on the lecture. Each question must have 4 options (A-D) and the correct answer. Put questions in keyTakeaways as structured strings like "Q: ... | A: ... | Correct: B | Explanation: ...". Use lectureContent for the quiz body.';
    case 'exam-review':
      return 'INTENT: EXAM-REVIEW. Create a comprehensive revision checklist. Cover all major concepts, formulas, definitions, and common pitfalls. Organize by topic. Use lectureContent for the main review material and keyTakeaways for the checklist items.';
    case 'explain':
    default:
      return 'INTENT: EXPLAIN. Become a patient teacher. Break the concept into simple parts. Use analogies and real-world examples. Build from simple to complex. Teach intuition, not just facts. The lectureContent must be a full educational explanation — never just a summary.';
  }
}

const MANDATORY_JSON_SCHEMA = [
  'MANDATORY JSON — every field is required. Empty strings, empty arrays, and one-word values are not allowed.',
  'If the transcript is thin, use your knowledge to generate complete answers.',
  'Return ONLY valid JSON. No markdown fences.',
  '',
  'Field requirements:',
  '  summary         — 1-2 sentence overview. Must be a real summary, not a restatement of the question.',
  '  lectureContent  — the MAIN educational answer. Minimum 3 sentences. Must teach the concept with examples, analogies, or step-by-step reasoning. Never empty, never just a summary.',
  '  additionalExplanation — REQUIRED. Add background knowledge, real-world analogies, simplified explanations, or worked examples. Minimum 2 sentences.',
  '  generalKnowledge — REQUIRED. Add standalone factual context, definitions, or broader context the student needs. Minimum 2 sentences.',
  '  keyTakeaways     — REQUIRED array of 3-5 specific study bullets. Each bullet must be a complete sentence. No generic bullets.',
  '  suggestedRelatedTopics — REQUIRED array of 2-3 adjacent topics to explore next.',
  '',
  'Example shape:',
  '  {',
  '    "summary": "This lecture covers X, Y, and Z...",',
  '    "lectureContent": "Full educational explanation here...",',
  '    "additionalExplanation": "Background and analogies here...",',
  '    "generalKnowledge": "Broader factual context here...",',
  '    "keyTakeaways": ["Specific bullet 1", "Specific bullet 2", "Specific bullet 3"],',
  '    "suggestedRelatedTopics": ["Topic A", "Topic B"]',
  '  }',
].join('\n');

function modeDepth(mode: ChatMode): string {
  if (mode === 'deep') {
    return 'DEPTH: DEEP. Give a thorough explanation with intuition, examples, and careful technical detail. Use the full output budget.';
  }
  if (mode === 'interview') {
    return 'DEPTH: INTERVIEW. Use interview-prep framing when useful, but still teach the underlying concept clearly with complete answers.';
  }
  return 'DEPTH: CONCISE. Be compact but still complete. Prioritize clarity and teaching over brevity. Every field must have real content.';
}

export const promptBuilderService = {
  chatSystem(mode: ChatMode = 'concise', language?: ResponseLanguageId): string {
    return [
      'You are an expert teacher and AI tutor for YouTube lecture content.',
      modeDepth(mode),
      'Your PRIMARY job is to produce complete educational answers across ALL JSON fields.',
      'lectureContent is the main answer, but additionalExplanation, generalKnowledge, and keyTakeaways are equally required.',
      'Use the transcript as the primary source whenever transcript context is provided.',
      'Do not copy transcript sentences verbatim. Synthesize, merge repeated ideas, and remove filler speech.',
      'Explain concepts naturally, simplify complex explanations, and preserve technical accuracy.',
      'Add missing background or examples when they help the student understand, but do not claim the lecture said them.',
      'Only say the lecture lacks coverage when no relevant transcript context is provided.',
      'Never return raw transcript excerpts as the final answer.',
      'Prioritize teaching over summarizing. The student wants to understand, not review.',
      localization.promptInstruction(language),
    ].join(' ');
  },

  buildStructuredChatPrompt(params: {
    mode: ChatMode;
    language?: ResponseLanguageId;
    coverage: CoverageCase;
    question: string;
    videoTitle?: string;
    videoId: string;
    context: string;
    lectureRelatedTopics: string[];
    intent?: Intent;
  }): { system: string; user: string } {
    const responseMode = coverageToMode(params.coverage);
    const intent = params.intent ?? detectIntent(params.question);
    const lectureTopicsLine =
      params.lectureRelatedTopics.length > 0
        ? `Detected lecture concepts: ${params.lectureRelatedTopics.join(', ')}`
        : 'Detected lecture concepts: none from retrieval.';

    const system = [
      this.chatSystem(params.mode, params.language),
      intentInstructions(intent),
      modeInstructions(responseMode),
      MANDATORY_JSON_SCHEMA,
      'Do not include mode, confidence, citations, or sources; the server computes those.',
      'Write readable educational content, not transcript snippets.',
    ].join('\n\n');

    const user = [
      `Video: ${params.videoTitle ?? params.videoId}`,
      `Retrieval coverage estimate: ${params.coverage}`,
      `Detected student intent: ${intent}`,
      lectureTopicsLine,
      '',
      'Student question:',
      params.question,
      '',
      'Retrieved transcript context — synthesize ALL of it, not just the first few chunks. If the context spans multiple topics, connect them:',
      params.context || '(no transcript chunks were retrieved)',
      '',
      'Instructions:',
      `- Respond in ${intent} mode: ${intentInstructions(intent).replace('INTENT: ' + intent.toUpperCase() + '. ', '')}`,
      '- Fill EVERY JSON field. Empty fields are not allowed.',
      '- If the transcript does not fully answer the question, use additionalExplanation and generalKnowledge to fill gaps.',
      '- Use the full output budget. Completeness matters more than brevity.',
      '- keyTakeaways must be specific to this question, not generic.',
    ].join('\n');

    return { system, user };
  },

  buildChatUserPrompt(params: {
    question: string;
    videoTitle?: string;
    videoId: string;
    chunks: SemanticChunkInput[];
  }): string {
    const context = params.chunks.map((c) => citationService.formatContextLine(c)).join('\n\n');
    return [
      `Video: ${params.videoTitle ?? params.videoId}`,
      '',
      'Student question:',
      params.question,
      '',
      'Retrieved transcript context:',
      context || '(no transcript chunks were retrieved)',
      '',
      'Synthesize the context into a natural teacher-style answer. Do not return raw transcript excerpts.',
    ].join('\n');
  },
};
