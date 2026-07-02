import { create } from 'zustand';
import type { Note, NoteType } from '@/types/notes';
import type { SemanticChunk } from '@/types/ai';
import { generateNote, listNotes, deleteNote, updateNoteContent } from './notes.service';

interface NotesState {
  notes: Note[];
  loading: boolean;
  error: string | null;
  load: (videoId: string) => Promise<void>;
  generate: (params: {
    videoId: string;
    type: NoteType;
    chunks: SemanticChunk[];
    videoTitle?: string;
    topicQuery?: string;
  }) => Promise<void>;
  updateContent: (id: string, content: string, title?: string) => Promise<void>;
  remove: (id: string, videoId: string) => Promise<void>;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  loading: false,
  error: null,

  load: async (videoId) => {
    set({ loading: true, error: null });
    try {
      const notes = await listNotes(videoId);
      set({ notes, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  generate: async ({ videoId, type, chunks, videoTitle, topicQuery }) => {
    set({ loading: true, error: null });
    try {
      const note = await generateNote({
        videoId,
        type,
        semanticChunks: chunks,
        videoTitle,
        topicQuery,
      });
      const notes = await listNotes(videoId);
      set({ notes, loading: false });
      void note;
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  remove: async (id, videoId) => {
    await deleteNote(id);
    const notes = await listNotes(videoId);
    set({ notes });
  },

  updateContent: async (id, content, title) => {
    const updated = await updateNoteContent(id, content, title);
    if (!updated) return;
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updated } : n)),
    }));
  },
}));
