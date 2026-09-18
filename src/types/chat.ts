import type { ChatCitation } from '@/types/ai';

export type CoverageCase = 'strong' | 'partial' | 'none';
export type ConfidenceLabel = 'high' | 'medium' | 'low';
export type ResponseMode = 'lecture-grounded' | 'hybrid' | 'general-knowledge';

export type ResponseSectionType = 'explanation' | 'steps' | 'technical' | 'application' | 'recap';

export type ResponseSectionItem = {
  title: string;
  content: string;
  type: ResponseSectionType;
  items?: string[];
};

export type StructuredChatPayload = {
  mode: ResponseMode;
  directAnswer?: string;
  summary: string;
  lectureContent: string;
  additionalExplanation: string;
  generalKnowledge: string;
  steps?: string[];
  technicalInsight?: string;
  applications?: string[];
  keyTakeaways: string[];
  sections?: ResponseSectionItem[];
  lectureRelatedTopics: string[];
  suggestedRelatedTopics: string[];
  coverage: CoverageCase;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  confidenceDisplayLabel?: string;
  confidenceReason?: string;
  /** @deprecated Use directAnswer or lectureContent */
  lectureAnswer?: string;
  /** @deprecated Use additionalExplanation + generalKnowledge */
  explanation?: string;
  /** @deprecated */
  keyPoints?: string[];
  /** @deprecated */
  relatedTopics?: string[];
  /** @deprecated */
  confidenceScore?: number;
};

export type ChatSource = {
  chunkId: string;
  videoId: string;
  videoTitle?: string;
  startTime: number;
  endTime: number;
  excerpt: string;
  similarityScore: number;
};

export type RetrievalMetadata = {
  coverage: CoverageCase;
  confidenceLabel: ConfidenceLabel;
  maxSimilarity: number;
  avgTopSimilarity: number;
  chunkCount: number;
  topChunkIds: string[];
  promptLengthChars: number;
  geminiLatencyMs: number;
};

export type StructuredChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  citations?: ChatCitation[];
  structured?: StructuredChatPayload;
  sources?: ChatSource[];
  retrievalMetadata?: RetrievalMetadata;
  streamingSection?: keyof StructuredChatPayload | 'sources' | null;
};

export type PipelineStage =
  | 'idle'
  | 'extracting-transcript'
  | 'generating-embeddings'
  | 'searching-knowledge'
  | 'generating-response'
  | 'rendering-citations'
  | 'complete'
  | 'error';

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  idle: '',
  'extracting-transcript': 'Extracting transcript…',
  'generating-embeddings': 'Generating embeddings…',
  'searching-knowledge': 'Searching knowledge base…',
  'generating-response': 'Generating response…',
  'rendering-citations': 'Rendering citations…',
  complete: 'Done',
  error: 'Something went wrong',
};

export const STRUCTURE_SECTIONS = [
  'summary',
  'lectureContent',
  'additionalExplanation',
  'generalKnowledge',
  'keyTakeaways',
  'lectureRelatedTopics',
  'suggestedRelatedTopics',
  'sources',
] as const;

export const MODE_LABELS: Record<ResponseMode, string> = {
  'lecture-grounded': 'Lecture grounded',
  hybrid: 'Hybrid explanation',
  'general-knowledge': 'General knowledge',
};

export type StructureSection = (typeof STRUCTURE_SECTIONS)[number];
