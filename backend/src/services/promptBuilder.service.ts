import type { ResponseLanguageId } from '../lib/languages.js';
import { localization } from '../lib/localization.service.js';
import type { CoverageCase } from './rag/coverage.js';
import { coverageToMode, modeInstructions } from './rag/responseMode.js';
import type { SemanticChunkInput } from './retrieval.service.js';
import { citationService } from './citation.service.js';

export type ChatMode = 'concise' | 'deep' | 'interview';

const JSON_SCHEMA = [
  'Return this exact JSON shape with string values and arrays:',
  '{"summary":"2-3 sentence educational overview",',
  '"lectureContent":"natural transcript-grounded explanation; empty only if no transcript context exists",',
  '"additionalExplanation":"helpful missing context beyond the transcript; empty if not needed",',
  '"generalKnowledge":"standalone answer only when no transcript context exists",',
  '"keyTakeaways":["concise study-note bullet","..."],',
  '"suggestedRelatedTopics":["only when no lecture concepts are available"]}',
].join('');

function modeDepth(mode: ChatMode): string {
  if (mode === 'deep') {
    return 'Give a thorough explanation with intuition, examples, and careful technical detail.';
  }
  if (mode === 'interview') {
    return 'Use interview-prep framing when useful, but still teach the underlying concept clearly.';
  }
  return 'Be concise, direct, and useful for a student reviewing the lecture.';
}

export const promptBuilderService = {
  chatSystem(mode: ChatMode = 'concise', language?: ResponseLanguageId): string {
    return [
      'You are an experienced teacher and AI tutor for YouTube lecture content.',
      modeDepth(mode),
      'Your job is to turn retrieved transcript context into high-quality study material.',
      'Use the transcript as the primary source whenever transcript context is provided.',
      'Do not copy transcript sentences verbatim. Synthesize, merge repeated ideas, and remove filler speech.',
      'Explain concepts naturally, simplify complex explanations, and preserve technical accuracy.',
      'Add missing background or examples when they help the student understand, but do not claim the lecture said them.',
      'For summaries, identify major concepts, merge similar ideas, and write concise instructor-style notes.',
      'Only say the lecture lacks coverage when no relevant transcript context is provided.',
      'Never return raw transcript excerpts as the final answer.',
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
  }): { system: string; user: string } {
    const responseMode = coverageToMode(params.coverage);
    const lectureTopicsLine =
      params.lectureRelatedTopics.length > 0
        ? `Detected lecture concepts: ${params.lectureRelatedTopics.join(', ')}`
        : 'Detected lecture concepts: none from retrieval.';

    const system = [
      this.chatSystem(params.mode, params.language),
      modeInstructions(responseMode),
      'Respond ONLY with valid JSON. Do not wrap it in markdown fences.',
      JSON_SCHEMA,
      'Do not include mode, confidence, citations, or sources; the server computes those.',
      'Write readable notes, not transcript snippets.',
    ].join('\n');

    const user = [
      `Video: ${params.videoTitle ?? params.videoId}`,
      `Retrieval coverage estimate: ${params.coverage}`,
      lectureTopicsLine,
      '',
      'Student question:',
      params.question,
      '',
      'Retrieved transcript context, in timestamp order when available:',
      params.context || '(no transcript chunks were retrieved)',
      '',
      'Write the final answer as polished study material. If transcript context exists, synthesize it before adding background.',
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
