import { ensureDbReady, getDb } from './db';
import { api } from './api/client';
import { getAuthToken } from './api/auth';

export type PersonalNoteItem = {
  id: string;
  userId?: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export async function fetchPersonalNotes(): Promise<PersonalNoteItem[]> {
  const token = await getAuthToken();
  if (token) {
    try {
      const resp = await api.get<{ notes: PersonalNoteItem[] }>('/api/personal-notes');
      // Also cache in local DB
      await ensureDbReady();
      for (const n of resp.notes) {
        await getDb().personalNotes.put({
          id: n.id,
          userId: n.userId,
          title: n.title,
          content: n.content,
          createdAt: typeof n.createdAt === 'string' ? new Date(n.createdAt).getTime() : n.createdAt,
          updatedAt: typeof n.updatedAt === 'string' ? new Date(n.updatedAt).getTime() : n.updatedAt,
        });
      }
      return resp.notes;
    } catch (e) {
      console.warn('[personalNotes] Remote fetch failed, using local offline fallback', e);
    }
  }

  await ensureDbReady();
  const rows = await getDb().personalNotes.orderBy('updatedAt').reverse().toArray();
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    content: r.content,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function createPersonalNote(title?: string, content?: string): Promise<PersonalNoteItem> {
  const token = await getAuthToken();
  const now = Date.now();
  const initialTitle = title?.trim() || 'My Study Note';
  const initialContent = content || '';

  if (token) {
    try {
      const resp = await api.post<{ note: PersonalNoteItem }>('/api/personal-notes', {
        title: initialTitle,
        content: initialContent,
      });
      const note = resp.note;
      await ensureDbReady();
      await getDb().personalNotes.put({
        id: note.id,
        userId: note.userId,
        title: note.title,
        content: note.content,
        createdAt: typeof note.createdAt === 'string' ? new Date(note.createdAt).getTime() : note.createdAt,
        updatedAt: typeof note.updatedAt === 'string' ? new Date(note.updatedAt).getTime() : note.updatedAt,
      });
      return note;
    } catch (e) {
      console.warn('[personalNotes] Remote create failed, using local mode', e);
    }
  }

  const localId = `pn_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const localNote: PersonalNoteItem = {
    id: localId,
    title: initialTitle,
    content: initialContent,
    createdAt: now,
    updatedAt: now,
  };

  await ensureDbReady();
  await getDb().personalNotes.put(localNote);
  return localNote;
}

export async function updatePersonalNote(id: string, title: string, content: string): Promise<void> {
  const token = await getAuthToken();
  const now = Date.now();

  await ensureDbReady();
  const existing = await getDb().personalNotes.get(id);
  const updatedRow: PersonalNoteItem = {
    id,
    userId: existing?.userId,
    title: title.trim() || 'Untitled Note',
    content,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await getDb().personalNotes.put(updatedRow);

  if (token) {
    try {
      await api.put(`/api/personal-notes/${encodeURIComponent(id)}`, {
        title: title.trim() || 'Untitled Note',
        content,
      });
    } catch (e) {
      console.warn('[personalNotes] Remote update failed', e);
    }
  }
}

export async function deletePersonalNote(id: string): Promise<void> {
  const token = await getAuthToken();

  await ensureDbReady();
  await getDb().personalNotes.delete(id);

  if (token) {
    try {
      await api.delete(`/api/personal-notes/${encodeURIComponent(id)}`);
    } catch (e) {
      console.warn('[personalNotes] Remote delete failed', e);
    }
  }
}
