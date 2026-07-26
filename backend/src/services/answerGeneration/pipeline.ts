import { geminiService } from '../gemini.service.js';
import { ragDevLog } from '../rag/devLog.js';

export type IntentAnalysis = {
  intent: string;
  targetConcept: string;
  difficulty: string;
  expectedOutput: string;
};

export type EvidenceSelection = {
  concept: string;
  supportingChunks: string[];
  confidence: string;
};

export type GeneratedAnswer = {
  content: string;
  additionalExplanation: string;
  generalKnowledge: string;
  keyTakeaways: string[];
};

export type FormattedResponse = {
  summary: string;
  lectureContent: string;
  additionalExplanation: string;
  generalKnowledge: string;
  keyTakeaways: string[];
  suggestedRelatedTopics: string[];
  intent: string;
  targetConcept: string;
  model: string;
  tokensUsed?: number;
};

const CHUNK_SEPARATOR = '\n---\n';

function buildChunkContext(chunks: Array<{ text: string; startTime: number; endTime: number }>): string {
  return chunks
    .map((c, i) => `[Chunk ${i + 1}] ${c.text}`)
    .join(CHUNK_SEPARATOR);
}

export async function runAnswerGenerationPipeline(params: {
  question: string;
  chunks: Array<{ text: string; startTime: number; endTime: number }>;
  mode: string;
  coverage: string;
  language?: string;
}): Promise<FormattedResponse> {
  const { question, chunks, mode, coverage } = params;
  const chunkContext = buildChunkContext(chunks);

  ragDevLog('pipeline:start', {
    question,
    mode,
    coverage,
    chunkCount: chunks.length,
    totalChunkChars: chunkContext.length,
  });

  const stage1 = await stage1IntentAnalysis(question, chunkContext, coverage);
  ragDevLog('pipeline:intent-analysis', stage1);

  const stage2 = await stage2EvidenceSelection(stage1, chunkContext);
  ragDevLog('pipeline:evidence-selection', {
    concept: stage2.concept,
    confidence: stage2.confidence,
    supportingChunkCount: stage2.supportingChunks.length,
  });

  const stage3 = await stage3AnswerGeneration(stage1, stage2);
  ragDevLog('pipeline:answer-generated', {
    contentLength: stage3.content.length,
    additionalExplanationLength: stage3.additionalExplanation.length,
    generalKnowledgeLength: stage3.generalKnowledge.length,
    keyTakeawaysCount: stage3.keyTakeaways.length,
  });

  const stage4 = await stage4Formatting(stage1, stage2, stage3, coverage);
  ragDevLog('pipeline:formatted', {
    summaryLength: stage4.summary.length,
    lectureContentLength: stage4.lectureContent.length,
    keyTakeawaysCount: stage4.keyTakeaways.length,
  });

  return stage4;
}

async function stage1IntentAnalysis(
  question: string,
  chunkContext: string,
  coverage: string
): Promise<IntentAnalysis> {
  const prompt = `You are an intent analyzer for a student question about lecture content.

Student question: ${question}

Retrieved lecture context:
${chunkContext || '(no transcript chunks were retrieved)'}

Analyze the question and context. Determine:
1. intent: one of [explain, compare, interview, walkthrough, notes, quiz, exam-review]
2. targetConcept: the specific concept the student wants explained. If the question asks for the "hardest concept", identify it from the retrieved context. If no clear hardest concept exists, say "The lecture does not clearly identify a hardest concept. The most complex topic appears to be..."
3. difficulty: beginner, intermediate, or advanced
4. expectedOutput: what format the answer should take

Rules:
- Never invent concepts not present in the retrieved context.
- Choose the most central and technically complex concept if multiple exist.
- If the retrieved context is empty, set targetConcept to "unknown" and expectedOutput to "general explanation".

Return ONLY valid JSON. No markdown fences.
{
  "intent": "...",
  "targetConcept": "...",
  "difficulty": "...",
  "expectedOutput": "..."
}`;

  const result = await geminiService.generateText({
    model: 'gemini-3.5-flash',
    prompt: { user: prompt },
    config: {
      temperature: 0.2,
      maxOutputTokens: 500,
    },
  });

  const trimmed = result.content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return {
      intent: String(parsed.intent ?? 'explain'),
      targetConcept: String(parsed.targetConcept ?? 'unknown'),
      difficulty: String(parsed.difficulty ?? 'intermediate'),
      expectedOutput: String(parsed.expectedOutput ?? 'explanation'),
    };
  } catch {
    ragDevLog('pipeline:intent-parse-failed', { raw: trimmed.slice(0, 300) });
    return {
      intent: 'explain',
      targetConcept: question,
      difficulty: 'intermediate',
      expectedOutput: 'explanation',
    };
  }
}

async function stage2EvidenceSelection(
  stage1: IntentAnalysis,
  chunkContext: string
): Promise<EvidenceSelection> {
  const prompt = `You are an evidence selector for a student question.

Target concept: ${stage1.targetConcept}
Student intent: ${stage1.intent}

Retrieved lecture chunks:
${chunkContext || '(no transcript chunks were retrieved)'}

Identify which chunks best support the target concept. Return JSON:
{
  "concept": "refined concept name",
  "supportingChunks": ["chunk text 1", "chunk text 2"],
  "confidence": "high|medium|low"
}

Rules:
- Only include chunks that directly support the concept.
- supportingChunks must contain the EXACT text from the retrieved chunks above.
- If no chunks clearly support the concept, return empty supportingChunks and low confidence.
- Do not invent or paraphrase chunk content.

Return ONLY valid JSON. No markdown fences.`;

  const result = await geminiService.generateText({
    model: 'gemini-3.5-flash',
    prompt: { user: prompt },
    config: {
      temperature: 0.2,
      maxOutputTokens: 800,
    },
  });

  const trimmed = result.content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const supportingChunks = Array.isArray(parsed.supportingChunks)
      ? parsed.supportingChunks.map(String).filter(Boolean)
      : [];

    return {
      concept: String(parsed.concept ?? stage1.targetConcept),
      supportingChunks,
      confidence: String(parsed.confidence ?? supportingChunks.length ? 'medium' : 'low'),
    };
  } catch {
    ragDevLog('pipeline:evidence-parse-failed', { raw: trimmed.slice(0, 300) });
    return {
      concept: stage1.targetConcept,
      supportingChunks: [],
      confidence: 'low',
    };
  }
}

async function stage3AnswerGeneration(
  stage1: IntentAnalysis,
  stage2: EvidenceSelection
): Promise<GeneratedAnswer> {
  const evidenceText = stage2.supportingChunks.length > 0
    ? stage2.supportingChunks.join(CHUNK_SEPARATOR)
    : 'No specific lecture context available. Use your knowledge to provide a helpful explanation.';

  const prompt = `You are an expert teacher and AI tutor for YouTube lecture content.

Target concept: ${stage1.targetConcept}
Student intent: ${stage1.intent}
Difficulty: ${stage1.difficulty}

Supporting evidence from the lecture:
${evidenceText}

Generate a comprehensive educational answer. Focus on:
- Clarity and simplicity
- Concrete examples from the lecture when available
- Analogies and intuition
- Step-by-step reasoning where appropriate
- Technical accuracy

Write in plain text. Do NOT use JSON or markdown formatting.`;

  const result = await geminiService.generateText({
    model: 'gemini-3.5-flash',
    prompt: { user: prompt },
    config: {
      temperature: 0.3,
      maxOutputTokens: 2000,
    },
  });

  const content = result.content.trim();

  return {
    content,
    additionalExplanation: '',
    generalKnowledge: '',
    keyTakeaways: [],
  };
}

async function stage4Formatting(
  stage1: IntentAnalysis,
  stage2: EvidenceSelection,
  stage3: GeneratedAnswer,
  coverage: string
): Promise<FormattedResponse> {
  const coverageInstruction =
    coverage === 'strong'
      ? 'The retrieved transcript strongly covers this topic. Ground claims in the evidence.'
      : coverage === 'partial'
        ? 'The retrieved transcript partially covers this topic. Use the evidence as an anchor and fill gaps with background knowledge.'
        : 'The lecture did not cover this topic. Provide the best answer using your knowledge. Never fabricate lecture quotes or timestamps.';

  const prompt = `You are a formatter. Convert this educational answer into structured JSON.

Answer: ${stage3.content}

Student intent: ${stage1.intent}
Coverage: ${coverage}
${coverageInstruction}

Return ONLY valid JSON. No markdown fences.
{
  "summary": "1-2 sentence overview of the answer",
  "lectureContent": "the main educational answer",
  "additionalExplanation": "background knowledge, analogies, simplified explanations, or worked examples",
  "generalKnowledge": "standalone factual context, definitions, or broader context the student needs",
  "keyTakeaways": ["specific study bullet 1", "specific study bullet 2", "specific study bullet 3"],
  "suggestedRelatedTopics": ["next topic to study", "next topic to study"]
}

Rules:
- summary must be 1-2 sentences, never a restatement of the question.
- lectureContent must be the main answer, never empty, never just a summary.
- additionalExplanation and generalKnowledge must both be non-empty. If the answer does not naturally contain these, generate appropriate background content.
- keyTakeaways must have exactly 3-5 items, each a complete sentence. No generic bullets.
- suggestedRelatedTopics must have 2-3 items.`;

  const result = await geminiService.generateText({
    model: 'gemini-3.5-flash',
    prompt: { user: prompt },
    config: {
      temperature: 0.3,
      maxOutputTokens: 1000,
    },
  });

  const trimmed = result.content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return {
      summary: String(parsed.summary ?? '').trim(),
      lectureContent: String(parsed.lectureContent ?? stage3.content).trim(),
      additionalExplanation: String(parsed.additionalExplanation ?? '').trim(),
      generalKnowledge: String(parsed.generalKnowledge ?? '').trim(),
      keyTakeaways: Array.isArray(parsed.keyTakeaways)
        ? parsed.keyTakeaways.map(String).filter(Boolean)
        : [],
      suggestedRelatedTopics: Array.isArray(parsed.suggestedRelatedTopics)
        ? parsed.suggestedRelatedTopics.map(String).filter(Boolean)
        : [],
      intent: stage1.intent,
      targetConcept: stage1.targetConcept,
      model: result.model,
      tokensUsed: result.tokensUsed,
    };
  } catch {
    ragDevLog('pipeline:format-parse-failed', { raw: trimmed.slice(0, 500) });

    const sentences = stage3.content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    return {
      summary: sentences.slice(0, 2).join('. ').trim() + '.',
      lectureContent: stage3.content,
      additionalExplanation: stage3.additionalExplanation || 'See the lecture content above for details.',
      generalKnowledge: stage3.generalKnowledge || 'Refer to the course materials for additional context.',
      keyTakeaways: stage3.keyTakeaways.length > 0 ? stage3.keyTakeaways : sentences.slice(0, 3).map((s) => s.trim()),
      suggestedRelatedTopics: [],
      intent: stage1.intent,
      targetConcept: stage1.targetConcept,
      model: result.model,
      tokensUsed: result.tokensUsed,
    };
  }
}
