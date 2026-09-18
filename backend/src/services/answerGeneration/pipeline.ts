import { groqService } from '../groq.service.js';
import { ragDevLog } from '../rag/devLog.js';

export type ResponseSectionItem = {
  title: string;
  content: string;
  type: 'explanation' | 'steps' | 'technical' | 'application' | 'recap';
  items?: string[];
};

export type FormattedResponse = {
  directAnswer: string;
  summary: string;
  explanation: string;
  lectureContent: string;
  steps: string[];
  technicalInsight: string;
  additionalExplanation: string;
  applications: string[];
  generalKnowledge: string;
  keyTakeaways: string[];
  sections: ResponseSectionItem[];
  suggestedRelatedTopics: string[];
  intent: string;
  targetConcept: string;
  model: string;
  tokensUsed?: number;
};

const CHUNK_SEPARATOR = '\n---\n';

const AI_TUTOR_SYSTEM_INSTRUCTION = `You are the AI tutor inside YT StudyFlow.

Your job is to answer the student's question clearly, accurately, and naturally.

You may receive transcript context from the current YouTube lecture.

Use the transcript when it is relevant and useful.

Important rules:

1. If the transcript contains the answer, prioritize the transcript.
2. If the transcript only partially answers the question, use the transcript plus your general knowledge to complete the explanation.
3. If the transcript does not contain the answer, answer using your general knowledge.
4. Never invent information and attribute it to the lecture.
5. Never claim that general knowledge came from the transcript.
6. Answer the student's actual question directly.
7. Explain difficult concepts simply while keeping important technical terminology.
8. Avoid unnecessary analogies.
9. Do not repeat the transcript verbatim unless a short quote is genuinely useful.
10. Do not expose retrieval scores, similarity scores, chunk IDs, embeddings, Pinecone metadata, or internal system information.
11. Do not output internal labels such as "confidence", "retrieval score", "general explanation", or "hybrid explanation".
12. Do not use excessive headings.
13. Do not begin with generic phrases such as "Welcome" or "Let's dive in".
14. Do not repeat the question.
15. Do not produce incomplete sentences or truncated responses.
16. Keep the response proportional to the question.
17. For simple questions, give a concise answer.
18. For conceptual questions, explain the concept with a short explanation followed by useful details.
19. If the student asks for a summary, actually summarize the main ideas instead of copying transcript sentences.
20. If the student asks for 3 points, provide exactly 3 meaningful points.`;

function buildChunkContext(chunks: Array<{ text: string; startTime: number; endTime: number }>): string {
  if (!chunks.length) return '';
  return chunks
    .map((c, i) => `[Timestamp: ${Math.floor(c.startTime / 60)}:${String(Math.floor(c.startTime % 60)).padStart(2, '0')}] ${c.text}`)
    .join(CHUNK_SEPARATOR);
}

function validateGroqResponse(content: string): { valid: boolean; reason?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, reason: 'Empty content string' };
  }
  const lower = content.toLowerCase();
  if (lower.includes('<svg') || lower.includes('[svg]')) {
    return { valid: false, reason: 'Contains raw SVG code' };
  }
  if (
    lower.includes('retrieval score') ||
    lower.includes('similarity score') ||
    lower.includes('candidatechunks') ||
    lower.includes('mmrchunks') ||
    lower.includes('pinecone')
  ) {
    return { valid: false, reason: 'Contains internal RAG/Pinecone metadata' };
  }
  // Check for unfinished sentence at end
  const trimmed = content.trim();
  const lastChar = trimmed.slice(-1);
  if (!['.', '!', '?', ')', '`', '"', "'"].includes(lastChar) && trimmed.length > 100) {
    return { valid: false, reason: 'Appears truncated or incomplete at sentence boundary' };
  }
  return { valid: true };
}

export async function runAnswerGenerationPipeline(params: {
  question: string;
  chunks: Array<{ text: string; startTime: number; endTime: number }>;
  mode: string;
  coverage: string;
  language?: string;
}): Promise<FormattedResponse> {
  const { question, chunks, coverage } = params;
  const chunkContext = buildChunkContext(chunks);

  const answerSource = coverage === 'strong' ? 'transcript' : coverage === 'partial' ? 'mixed' : 'general';

  ragDevLog('retrieval-complete', {
    chunkCount: chunks.length,
    coverage,
    hasContext: !!chunkContext,
  });

  ragDevLog('answer-source', answerSource);

  const userPrompt = `Student Question: ${question}

${
  chunkContext
    ? `Retrieved Lecture Transcript Context:\n${chunkContext}`
    : `(Note: No relevant transcript content was found in the lecture for this specific question. Please answer naturally using your general knowledge.)`
}

Please provide a direct, clean, well-formatted response to the student.`;

  ragDevLog('groq:request', {
    userPromptChars: userPrompt.length,
    hasSystemInstruction: true,
  });

  let groqResult = await groqService.generateText({
    prompt: {
      system: AI_TUTOR_SYSTEM_INSTRUCTION,
      user: userPrompt,
    },
    config: {
      temperature: 0.3,
      maxOutputTokens: 1800,
    },
  });

  ragDevLog('groq:response', {
    model: groqResult.model,
    contentLength: groqResult.content.length,
    tokensUsed: groqResult.tokensUsed,
  });

  // Response Validation
  let validation = validateGroqResponse(groqResult.content);
  if (!validation.valid) {
    ragDevLog('groq:validation-failed', { reason: validation.reason, retrying: true });
    
    // Single retry with correction instruction
    const retryUserPrompt = `${userPrompt}\n\nCorrection instruction: Your previous attempt failed validation (${validation.reason}). Please output clean, direct natural text with complete sentences and no internal debug/metadata output.`;
    
    groqResult = await groqService.generateText({
      prompt: {
        system: AI_TUTOR_SYSTEM_INSTRUCTION,
        user: retryUserPrompt,
      },
      config: {
        temperature: 0.2,
        maxOutputTokens: 1800,
      },
    });

    validation = validateGroqResponse(groqResult.content);
    if (!validation.valid) {
      ragDevLog('groq:retry-validation-warning', { reason: validation.reason });
    }
  }

  return parseAndFormatResponse(question, groqResult.content, groqResult.model, groqResult.tokensUsed, coverage);
}

function parseAndFormatResponse(
  question: string,
  rawContent: string,
  model: string,
  tokensUsed: number | undefined,
  coverage: string
): FormattedResponse {
  const cleaned = rawContent
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/\[svg[^\]]*\]/gi, '')
    .replace(/^(welcome!?|hello!?|sure!?|great question!?)[,\s\-]*/i, '')
    .trim();

  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  // Extract direct answer from first paragraph or line
  const firstPara = paragraphs[0] || cleaned;
  let directAnswer = firstPara.split('\n')[0] || firstPara;
  if (directAnswer.length > 280) {
    const endDot = directAnswer.indexOf('.', 100);
    if (endDot > 0 && endDot < 280) {
      directAnswer = directAnswer.slice(0, endDot + 1);
    }
  }

  // Extract numbered steps if present
  const stepLines = cleaned.split('\n').filter((l) => /^\s*\d+[\.\)]\s+/.test(l));
  const steps = stepLines.map((l) => l.replace(/^\s*\d+[\.\)]\s+/, '').trim());

  // Extract bullet key takeaways if present
  const bulletLines = cleaned.split('\n').filter((l) => /^\s*[\-\*•]\s+/.test(l));
  const keyTakeaways = bulletLines.map((l) => l.replace(/^\s*[\-\*•]\s+/, '').trim()).slice(0, 5);

  // Build section items naturally if headings exist
  const sections: ResponseSectionItem[] = [];
  if (cleaned.length > 0) {
    sections.push({
      title: 'Explanation',
      content: cleaned,
      type: 'explanation',
    });
  }

  return {
    directAnswer,
    summary: directAnswer,
    explanation: cleaned,
    lectureContent: coverage !== 'none' ? cleaned : '',
    steps,
    technicalInsight: '',
    additionalExplanation: '',
    applications: [],
    generalKnowledge: coverage === 'none' ? cleaned : '',
    keyTakeaways,
    sections,
    suggestedRelatedTopics: [],
    intent: 'explain',
    targetConcept: question,
    model,
    tokensUsed,
  };
}


