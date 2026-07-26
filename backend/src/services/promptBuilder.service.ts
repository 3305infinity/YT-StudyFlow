import type { ResponseLanguageId } from '../lib/languages.js';
import { localization } from '../lib/localization.service.js';
import type { CoverageCase } from './rag/coverage.js';
import { coverageToMode, modeInstructions } from './rag/responseMode.js';
import type { SemanticChunkInput } from './retrieval.service.js';
import { citationService } from './citation.service.js';

export type ChatMode = 'concise' | 'deep' | 'interview';

export type Intent = 'explain' | 'compare' | 'interview' | 'walkthrough' | 'notes' | 'quiz' | 'exam-review';

export type IntentSchema =
  | 'explain'
  | 'compare'
  | 'interview'
  | 'walkthrough'
  | 'notes'
  | 'quiz'
  | 'exam-review';

export interface ExplainResponse {
  concept: string;
  simpleExplanation: string;
  example: string;
  analogy: string;
}

export interface CompareResponse {
  comparison: Array<{
    aspect: string;
    itemA: string;
    itemB: string;
    verdict: string;
  }>;
}

export interface InterviewResponse {
  questions: Array<{
    question: string;
    answer: string;
    followUp: string;
  }>;
}

export interface WalkthroughResponse {
  steps: Array<{
    step: number;
    action: string;
    why: string;
    pitfall: string;
  }>;
}

export interface NotesResponse {
  sections: Array<{
    heading: string;
    bullets: string[];
  }>;
}

export interface QuizResponse {
  questions: Array<{
    question: string;
    options: string[];
    correct: string;
    explanation: string;
  }>;
}

export interface ExamReviewResponse {
  topics: Array<{
    topic: string;
    keyPoints: string[];
    formula?: string;
    pitfall: string;
  }>;
}

export type IntentResponse =
  | ExplainResponse
  | CompareResponse
  | InterviewResponse
  | WalkthroughResponse
  | NotesResponse
  | QuizResponse
  | ExamReviewResponse;

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

const INTENT_INSTRUCTIONS: Record<Intent, string> = {
  explain: 'Teach the concept with a clear definition, simple explanation, concrete example, and analogy.',
  compare: 'Create a structured comparison covering what each item is, how they differ, when to use each, and the verdict.',
  interview: 'Generate likely exam/interview questions with detailed model answers and follow-up questions.',
  walkthrough: 'Provide a numbered step-by-step guide with actions, reasons, and common pitfalls.',
  notes: 'Create structured study notes with clear headings and bullet points.',
  quiz: 'Generate multiple-choice questions with 4 options, the correct answer, and explanation.',
  'exam-review': 'Create a comprehensive revision checklist organized by topic with key points and common pitfalls.',
};

const INTENT_SCHEMAS: Record<IntentSchema, string> = {
  explain: `Return JSON:
{
  "concept": "concept name",
  "simpleExplanation": "plain-language explanation",
  "example": "concrete example from the lecture",
  "analogy": "real-world analogy"
}`,
  compare: `Return JSON:
{
  "comparison": [
    {
      "aspect": "dimension being compared",
      "itemA": "how first item relates",
      "itemB": "how second item relates",
      "verdict": "which to use when"
    }
  ]
}`,
  interview: `Return JSON:
{
  "questions": [
    {
      "question": "likely exam/interview question",
      "answer": "detailed model answer",
      "followUp": "follow-up question to test deeper understanding"
    }
  ]
}`,
  walkthrough: `Return JSON:
{
  "steps": [
    {
      "step": 1,
      "action": "what to do",
      "why": "why this step matters",
      "pitfall": "what to watch out for"
    }
  ]
}`,
  notes: `Return JSON:
{
  "sections": [
    {
      "heading": "topic name",
      "bullets": ["specific study point", "specific study point"]
    }
  ]
}`,
  quiz: `Return JSON:
{
  "questions": [
    {
      "question": "question text",
      "options": ["A. option", "B. option", "C. option", "D. option"],
      "correct": "A",
      "explanation": "why this answer is correct"
    }
  ]
}`,
  'exam-review': `Return JSON:
{
  "topics": [
    {
      "topic": "topic name",
      "keyPoints": ["key point 1", "key point 2"],
      "formula": "if applicable",
      "pitfall": "common mistake to avoid"
    }
  ]
}`,
};

function modeDepth(mode: ChatMode): string {
  if (mode === 'deep') {
    return 'DEPTH: DEEP. Provide thorough, detailed answers with intuition, examples, and careful technical depth.';
  }
  if (mode === 'interview') {
    return 'DEPTH: INTERVIEW. Frame answers for exam/interview preparation with complete, precise responses.';
  }
  return 'DEPTH: CONCISE. Be compact but complete. Prioritize clarity and teaching over brevity.';
}

export const promptBuilderService = {
  chatSystem(mode: ChatMode = 'concise', language?: ResponseLanguageId): string {
    return [
      'You are an expert teacher and AI tutor for YouTube lecture content.',
      modeDepth(mode),
      'Use the transcript as the primary source. Synthesize, do not copy verbatim.',
      'Explain concepts clearly, preserve technical accuracy, and add background only when it helps understanding.',
      'Never claim the lecture said something it did not.',
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
      INTENT_INSTRUCTIONS[intent],
      INTENT_SCHEMAS[intent],
      modeInstructions(responseMode),
      'Return ONLY valid JSON. No markdown fences.',
      'Do not include mode, confidence, citations, or sources.',
    ].join('\n');

    const user = [
      `Video: ${params.videoTitle ?? params.videoId}`,
      `Coverage: ${params.coverage}`,
      `Intent: ${intent}`,
      lectureTopicsLine,
      '',
      `Question: ${params.question}`,
      '',
      'Transcript context:',
      params.context || '(no transcript chunks were retrieved)',
      '',
      'Instructions:',
      '- Stay grounded in the transcript. Do not invent lecture quotes.',
      '- Fill every field in the JSON schema.',
      '- If the transcript is thin, use your knowledge to complete the answer.',
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
