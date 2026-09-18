import { useEffect, useState, useCallback } from 'react';
import { FileText, Pencil, Plus, Save, Trash2, Sun, Moon, Loader2, AlertCircle, BookOpen, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

import { useNotesStore } from './notes.store';
import { useRagStore } from '@/store/rag.store';
import { useVideoStore } from '@/store/video.store';
import { useSettingsStore } from '@/store/settings.store';
import type { NoteType } from '@/types/notes';
import { Loader } from '@/components/Loader';
import { FeatureGate } from '@/components/FeatureGate';
import { WorkspaceShell } from '@/components/WorkspaceShell';
import { FormattedMarkdownText } from '@/components/FormattedMarkdownText';
import { useAiReadiness } from '@/hooks/useAiReadiness';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Button } from '@/components/Button';
import { transformContentLanguage, invalidateNoteLanguageCache } from '@/lib/noteLanguageCache';
import { languageLabel } from '@/lib/localization.service';
import {
  fetchPersonalNotes,
  createPersonalNote,
  updatePersonalNote,
  deletePersonalNote,
  type PersonalNoteItem,
} from '@/lib/personalNotes.service';

const NOTE_TYPES: Array<{ id: NoteType; label: string }> = [
  { id: 'concise', label: 'Concise' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'interview', label: 'Interview' },
  { id: 'revision', label: 'Revision' },
];

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotesPanel({ videoId }: { videoId: string }) {
  // Mode: AI Notes vs My Notes
  const [workspaceMode, setWorkspaceMode] = useState<'ai' | 'personal'>('ai');

  // AI Notes state
  const { notes, loading, error, load, generate, remove, updateContent } = useNotesStore();
  const chunks = useRagStore((s) => s.chunks);
  const title = useVideoStore((s) => s.title);
  const defaultNoteType = useSettingsStore((s) => s.defaultNoteType);
  const responseLanguage = useSettingsStore((s) => s.responseLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const readiness = useAiReadiness();

  // Personal Notes state
  const [personalNotes, setPersonalNotes] = useState<PersonalNoteItem[]>([]);
  const [personalSelectedId, setPersonalSelectedId] = useState<string | null>(null);
  const [personalEditing, setPersonalEditing] = useState(false);
  const [personalTitleDraft, setPersonalTitleDraft] = useState('');
  const [personalContentDraft, setPersonalContentDraft] = useState('');

  // Language transformation state for AI notes
  const [displayContent, setDisplayContent] = useState<string>('');
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    void load(videoId);
  }, [videoId, load]);

  const loadPersonal = useCallback(async () => {
    const list = await fetchPersonalNotes();
    setPersonalNotes(list);
    if (list.length && !personalSelectedId) {
      setPersonalSelectedId(list[0]!.id);
    }
  }, [personalSelectedId]);

  useEffect(() => {
    void loadPersonal();
  }, [loadPersonal]);

  useEffect(() => {
    if (notes.length && !selected) setSelected(notes[0]!.id);
  }, [notes, selected]);

  const activeAiNote = notes.find((n) => n.id === selected) ?? notes[0];
  const activePersonalNote = personalNotes.find((p) => p.id === personalSelectedId) ?? personalNotes[0];

  useEffect(() => {
    if (activeAiNote && !editing) {
      setDraft(activeAiNote.content);
    }
  }, [activeAiNote?.id, activeAiNote?.content, editing]);

  useEffect(() => {
    if (activePersonalNote && !personalEditing) {
      setPersonalTitleDraft(activePersonalNote.title);
      setPersonalContentDraft(activePersonalNote.content);
    }
  }, [activePersonalNote?.id, activePersonalNote?.title, activePersonalNote?.content, personalEditing]);

  // Handle language transformation & local cache for AI notes
  useEffect(() => {
    if (!activeAiNote || workspaceMode !== 'ai') {
      setDisplayContent('');
      return;
    }

    if (responseLanguage === 'en') {
      setDisplayContent(editing ? draft : activeAiNote.content);
      setTranslating(false);
      setTranslationError(null);
      return;
    }

    let isSubscribed = true;
    setTranslating(true);
    setTranslationError(null);

    const baseText = editing ? draft : activeAiNote.content;

    transformContentLanguage({
      noteId: activeAiNote.id,
      content: baseText,
      targetLanguage: responseLanguage,
    })
      .then((transformed) => {
        if (isSubscribed) {
          setDisplayContent(transformed);
          setTranslating(false);
        }
      })
      .catch(() => {
        if (isSubscribed) {
          setTranslating(false);
          setTranslationError(`Couldn't generate ${languageLabel(responseLanguage)} right now. Try again.`);
          setDisplayContent(baseText);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [activeAiNote?.id, activeAiNote?.content, responseLanguage, editing, draft, workspaceMode]);

  const handleSaveAi = useCallback(async () => {
    if (!activeAiNote) return;
    await updateContent(activeAiNote.id, draft);
    await invalidateNoteLanguageCache(activeAiNote.id);
    setEditing(false);
  }, [activeAiNote, draft, updateContent]);

  const handleCreatePersonal = async () => {
    const created = await createPersonalNote('My Study Note', '');
    setPersonalNotes((prev) => [created, ...prev]);
    setPersonalSelectedId(created.id);
    setPersonalTitleDraft(created.title);
    setPersonalContentDraft(created.content);
    setPersonalEditing(true);
  };

  const handleSavePersonal = async () => {
    if (!activePersonalNote) return;
    await updatePersonalNote(activePersonalNote.id, personalTitleDraft, personalContentDraft);
    setPersonalNotes((prev) =>
      prev.map((p) =>
        p.id === activePersonalNote.id
          ? { ...p, title: personalTitleDraft, content: personalContentDraft, updatedAt: Date.now() }
          : p
      )
    );
    setPersonalEditing(false);
  };

  const handleDeletePersonal = async (id: string) => {
    await deletePersonalNote(id);
    const updated = personalNotes.filter((p) => p.id !== id);
    setPersonalNotes(updated);
    setPersonalSelectedId(updated[0]?.id ?? null);
    setPersonalEditing(false);
  };

  if (readiness.state !== 'ready') {
    return <FeatureGate>{null}</FeatureGate>;
  }

  return (
    <div className={clsx('h-full w-full font-sans transition-colors duration-200', theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-base text-content')}>
      <WorkspaceShell
        title="Notes Workspace"
        subtitle="Structured AI study notes & personal notebook"
        actions={
          <div className="flex items-center gap-2">
            <LanguageSelector showLabel />
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                theme === 'light'
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  : 'border-line bg-surface-raised text-content-muted hover:bg-surface-overlay hover:text-content'
              )}
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-600" />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            {workspaceMode === 'ai' ? (
              <Button
                type="button"
                disabled={loading}
                onClick={() => generate({ videoId, type: defaultNoteType, chunks, videoTitle: title ?? undefined })}
                size="sm"
              >
                <Plus className="h-3.5 w-3.5" />
                New AI Note
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleCreatePersonal()}
                size="sm"
              >
                <Plus className="h-3.5 w-3.5" />
                New Note
              </Button>
            )}
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Mode Switcher: AI Notes vs My Notes */}
          <div className={clsx('flex items-center justify-between border-b px-4 py-2', theme === 'light' ? 'border-slate-200 bg-white' : 'border-line bg-surface')}>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setWorkspaceMode('ai')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                  workspaceMode === 'ai'
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-transparent text-content-subtle hover:text-content'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Notes</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode('personal')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                  workspaceMode === 'personal'
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-transparent text-content-subtle hover:text-content'
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>My Notes</span>
              </button>
            </div>

            {workspaceMode === 'ai' && (
              <div className="flex gap-1 overflow-x-auto">
                {NOTE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={loading}
                    onClick={() => generate({ videoId, type: t.id, chunks, videoTitle: title ?? undefined })}
                    className={clsx(
                      'shrink-0 rounded-md border px-2.5 py-0.5 text-[11px] font-medium transition-all disabled:opacity-40',
                      theme === 'light'
                        ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'border-line bg-surface-raised text-content-muted hover:text-content'
                    )}
                  >
                    + {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {workspaceMode === 'ai' && loading && (
            <div className="border-b border-line px-4 py-3">
              <Loader label="Generating study notes via Groq..." />
            </div>
          )}
          {workspaceMode === 'ai' && error && <ErrorBanner message={error} />}

          {workspaceMode === 'ai' && translating && (
            <div className="flex items-center gap-2 border-b border-brand/30 bg-brand/10 px-4 py-2 text-xs font-medium text-brand">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              <span>Translating content to {languageLabel(responseLanguage)} via Groq...</span>
            </div>
          )}

          {workspaceMode === 'ai' && translationError && (
            <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{translationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setTranslationError(null)}
                className="text-caption hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Main Layout: Fixed 260px Sidebar + Full Content Workspace */}
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* Sidebar (Fixed 260px width) */}
            <aside className={clsx('w-full md:w-[260px] shrink-0 overflow-y-auto border-r p-3 space-y-1.5', theme === 'light' ? 'border-slate-200 bg-slate-100/60' : 'border-line bg-surface')}>
              <div className="px-2 py-1 text-micro font-semibold uppercase tracking-wider text-content-subtle">
                {workspaceMode === 'ai' ? `AI Study Notes (${notes.length})` : `My Personal Notes (${personalNotes.length})`}
              </div>

              {workspaceMode === 'ai'
                ? notes.map((n) => {
                    const isSelected = activeAiNote?.id === n.id;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setSelected(n.id);
                          setEditing(false);
                        }}
                        className={clsx(
                          'w-full rounded-lg p-3 text-left transition-all duration-170 border',
                          isSelected
                            ? theme === 'light'
                              ? 'border-indigo-400 bg-white text-slate-900 shadow-sm'
                              : 'border-brand/40 bg-surface-overlay text-content shadow-1'
                            : theme === 'light'
                              ? 'border-transparent text-slate-700 hover:bg-slate-200/70'
                              : 'border-transparent text-content-muted hover:bg-surface-raised'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={clsx(
                            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize',
                            n.type === 'interview'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : n.type === 'revision'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-brand/15 text-brand border border-brand/30'
                          )}>
                            {n.type}
                          </span>
                          <span className="text-[11px] text-content-subtle">{formatTimeAgo(n.updatedAt)}</span>
                        </div>
                        <p className="text-xs font-semibold leading-snug line-clamp-2 text-content">
                          {n.title}
                        </p>
                      </button>
                    );
                  })
                : personalNotes.map((p) => {
                    const isSelected = activePersonalNote?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPersonalSelectedId(p.id);
                          setPersonalEditing(false);
                        }}
                        className={clsx(
                          'w-full rounded-lg p-3 text-left transition-all duration-170 border',
                          isSelected
                            ? theme === 'light'
                              ? 'border-indigo-400 bg-white text-slate-900 shadow-sm'
                              : 'border-brand/40 bg-surface-overlay text-content shadow-1'
                            : theme === 'light'
                              ? 'border-transparent text-slate-700 hover:bg-slate-200/70'
                              : 'border-transparent text-content-muted hover:bg-surface-raised'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="inline-flex items-center rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/30">
                            Personal
                          </span>
                          <span className="text-[11px] text-content-subtle">{formatTimeAgo(p.updatedAt)}</span>
                        </div>
                        <p className="text-xs font-semibold leading-snug line-clamp-2 text-content">
                          {p.title || 'Untitled Note'}
                        </p>
                      </button>
                    );
                  })}
            </aside>

            {/* Note Detail / Editor Area (Spacious Width) */}
            <main className={clsx('min-h-0 flex-1 overflow-y-auto px-6 py-6', theme === 'light' ? 'bg-white text-slate-900' : 'bg-base text-content')}>
              {workspaceMode === 'ai' ? (
                activeAiNote ? (
                  <div className="mx-auto max-w-4xl space-y-6">
                    <div className="flex items-start justify-between gap-4 border-b border-line/60 pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs font-semibold capitalize text-brand">
                            {activeAiNote.type} Note
                          </span>
                          <span className="text-xs text-content-subtle">
                            Updated {formatTimeAgo(activeAiNote.updatedAt)}
                          </span>
                        </div>
                        <h2 className="text-heading font-bold tracking-tight text-content">
                          {activeAiNote.title}
                        </h2>
                      </div>

                      <div className="flex items-center gap-2">
                        {editing ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleSaveAi()}
                            className="gap-1.5"
                          >
                            <Save className="h-4 w-4" />
                            <span>Save</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(true)}
                            className="gap-1.5"
                          >
                            <Pencil className="h-4 w-4" />
                            <span>Edit</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => remove(activeAiNote.id, videoId)}
                          className="gap-1.5"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>

                    {editing ? (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-content-subtle">Edit Markdown Content</label>
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className={clsx(
                            'min-h-[360px] w-full rounded-xl border p-4 font-mono text-[14px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/40',
                            theme === 'light'
                              ? 'border-slate-300 bg-slate-50 text-slate-900'
                              : 'border-line bg-surface text-content'
                          )}
                          aria-label="Edit note content"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="leading-relaxed">
                          <FormattedMarkdownText
                            text={displayContent || activeAiNote.content}
                            className="text-[15px] leading-[1.7] text-content"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-brand/10 p-4 mb-3">
                      <FileText className="h-8 w-8 text-brand" />
                    </div>
                    <h3 className="text-subheading font-bold text-content">No AI Notes Yet</h3>
                    <p className="mt-1 text-caption text-content-subtle max-w-sm">
                      Select a note type above to generate structured AI study notes for this video.
                    </p>
                  </div>
                )
              ) : activePersonalNote ? (
                <div className="mx-auto max-w-4xl space-y-6">
                  <div className="flex items-start justify-between gap-4 border-b border-line/60 pb-4">
                    <div className="space-y-2 flex-1">
                      {personalEditing ? (
                        <input
                          type="text"
                          value={personalTitleDraft}
                          onChange={(e) => setPersonalTitleDraft(e.target.value)}
                          className={clsx(
                            'w-full rounded-lg border px-3 py-1.5 text-lg font-bold text-content focus:outline-none focus:ring-2 focus:ring-brand/40',
                            theme === 'light' ? 'border-slate-300 bg-slate-50' : 'border-line bg-surface'
                          )}
                          placeholder="Note Title..."
                        />
                      ) : (
                        <div>
                          <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400">
                            Personal Note
                          </span>
                          <h2 className="text-heading font-bold tracking-tight text-content mt-1">
                            {activePersonalNote.title || 'Untitled Note'}
                          </h2>
                        </div>
                      )}
                      <span className="text-xs text-content-subtle block">
                        Updated {formatTimeAgo(activePersonalNote.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {personalEditing ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleSavePersonal()}
                          className="gap-1.5"
                        >
                          <Save className="h-4 w-4" />
                          <span>Save</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPersonalEditing(true)}
                          className="gap-1.5"
                        >
                          <Pencil className="h-4 w-4" />
                          <span>Edit</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDeletePersonal(activePersonalNote.id)}
                        className="gap-1.5"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </div>

                  {personalEditing ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-content-subtle">Personal Note Content</label>
                      <textarea
                        value={personalContentDraft}
                        onChange={(e) => setPersonalContentDraft(e.target.value)}
                        placeholder="Write your study notes, insights, key takeaways..."
                        className={clsx(
                          'min-h-[360px] w-full rounded-xl border p-4 font-mono text-[14px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/40',
                          theme === 'light'
                            ? 'border-slate-300 bg-slate-50 text-slate-900'
                            : 'border-line bg-surface text-content'
                        )}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activePersonalNote.content ? (
                        <FormattedMarkdownText
                          text={activePersonalNote.content}
                          className="text-[15px] leading-[1.7] text-content"
                        />
                      ) : (
                        <p className="text-sm italic text-content-subtle">
                          This personal note is currently empty. Click "Edit" above to add your study notes.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-indigo-500/10 p-4 mb-3">
                    <BookOpen className="h-8 w-8 text-indigo-400" />
                  </div>
                  <h3 className="text-subheading font-bold text-content">No Personal Notes Yet</h3>
                  <p className="mt-1 text-caption text-content-subtle max-w-sm">
                    Click "New Note" above to write your own personal study notes.
                  </p>
                </div>
              )}
            </main>
          </div>
        </div>
      </WorkspaceShell>
    </div>
  );
}
