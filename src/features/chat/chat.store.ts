import { create } from 'zustand';
import type { ChatCitation, ChatMessage } from '@/types/ai';
import type { StructuredChatPayload, RetrievalMetadata } from '@/types/chat';

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  activeRequestId: number;
  beginRequest: () => number;
  isActiveRequest: (requestId: number) => boolean;
  addUserMessage: (content: string) => string;
  addAssistantPlaceholder: () => string;
  finalizeAssistant: (id: string, content: string, citations?: ChatCitation[]) => void;
  finalizeStructured: (
    id: string,
    payload: {
      content: string;
      structured: StructuredChatPayload;
      citations?: ChatCitation[];
      sources?: ChatMessage['sources'];
      retrievalMetadata?: RetrievalMetadata;
    },
    requestId: number
  ) => void;
  failRequest: (requestId: number, assistantId: string, message: string) => void;
  revealSection: (id: string, section: string, requestId: number) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clear: () => void;
}

let msgCounter = 0;
function newId(): string {
  return `msg_${Date.now()}_${++msgCounter}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  error: null,
  activeRequestId: 0,

  beginRequest: () => {
    const requestId = get().activeRequestId + 1;
    set({ activeRequestId: requestId, loading: true, error: null });
    return requestId;
  },

  isActiveRequest: (requestId) => get().activeRequestId === requestId,

  addUserMessage: (content) => {
    const id = newId();
    set((s) => ({
      messages: [...s.messages, { id, role: 'user', content, timestamp: Date.now() }],
      error: null,
    }));
    return id;
  },

  addAssistantPlaceholder: () => {
    const id = newId();
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          visibleSections: [],
        },
      ],
    }));
    return id;
  },

  finalizeAssistant: (id, content, citations) => {
    set((s) => ({
      loading: false,
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content, citations, visibleSections: ['content'] } : m
      ),
    }));
  },

  finalizeStructured: (id, payload, requestId) => {
    if (!get().isActiveRequest(requestId)) return;
    set((s) => ({
      loading: false,
      error: null,
      messages: s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              content: payload.content,
              structured: payload.structured,
              citations: payload.citations,
              sources: payload.sources,
              retrievalMetadata: payload.retrievalMetadata,
              visibleSections: ['summary'],
            }
          : m
      ),
    }));
  },

  failRequest: (requestId, assistantId, message) => {
    if (!get().isActiveRequest(requestId)) return;
    set((s) => ({
      loading: false,
      error: message,
      messages: s.messages.filter((m) => m.id !== assistantId),
    }));
  },

  revealSection: (id, section, requestId) => {
    if (!get().isActiveRequest(requestId)) return;
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== id) return m;
        const visible = new Set(m.visibleSections ?? []);
        visible.add(section);
        return { ...m, visibleSections: [...visible] };
      }),
    }));
  },

  setError: (error) => set({ error, loading: false }),
  setLoading: (loading) => set({ loading }),
  setMessages: (messages) => set({ messages }),
  clear: () => set({ messages: [], loading: false, error: null, activeRequestId: 0 }),
}));
