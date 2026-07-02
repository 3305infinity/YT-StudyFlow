import { useEffect, useState, useCallback } from 'react';
import { FileText, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useNotesStore } from './notes.store';
import { useRagStore } from '@/store/rag.store';
import { useVideoStore } from '@/store/video.store';
import { useSettingsStore } from '@/store/settings.store';
import type { NoteType } from '@/types/notes';
import { Loader } from '@/components/Loader';
import { FeatureGate } from '@/components/FeatureGate';
import { WorkspaceShell } from '@/components/WorkspaceShell';
import { MarkdownView } from '@/components/MarkdownView';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { useAiReadiness } from '@/hooks/useAiReadiness';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LanguageBadge } from '@/components/LanguageSelector';

const NOTE_TYPES: Array<{ id: NoteType; label: string }> = [
  { id: 'concise', label: 'Concise' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'interview', label: 'Interview' },
  { id: 'revision', label: 'Revision' },
];

function parseNoteSections(content: string) {
  const lines = content.split('\n');
  const sections: Array<{ title: string; body: string }> = [];
  let current = { title: 'Overview', body: '' as string };

  for (const line of lines) {
    if (line.startsWith('## ') || line.startsWith('# ')) {
      if (current.body.trim()) sections.push(current);
      current = { title: line.replace(/^#+\s*/, ''), body: '' };
    } else {
      current.body += `${line}\n`;
    }
  }
  if (current.body.trim()) sections.push(current);
  return sections.length ? sections : [{ title: 'Notes', body: content }];
}

export function NotesPanel({ videoId }: { videoId: string }) {
  const { notes, loading, error, load, generate, remove, updateContent } = useNotesStore();
  const chunks = useRagStore((s) => s.chunks);
  const title = useVideoStore((s) => s.title);
  const defaultNoteType = useSettingsStore((s) => s.defaultNoteType);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const readiness = useAiReadiness();

  useEffect(() => {
    void load(videoId);
  }, [videoId, load]);

  useEffect(() => {
    if (notes.length && !selected) setSelected(notes[0]!.id);
  }, [notes, selected]);

  const active = notes.find((n) => n.id === selected) ?? notes[0];

  useEffect(() => {
    if (active && !editing) setDraft(active.content);
  }, [active?.id, active?.content, editing]);

  const handleSave = useCallback(async () => {
    if (!active) return;
    await updateContent(active.id, draft);
    setEditing(false);
  }, [active, draft, updateContent]);

  if (readiness.state !== 'ready') {
    return <FeatureGate>{null}</FeatureGate>;
  }

  const sections = active ? parseNoteSections(editing ? draft : active.content) : [];

  return (
    <WorkspaceShell
      title="Notes"
      subtitle="Structured study notes — edit and persist locally"
      actions={
        <>
          <LanguageBadge />
          <button
          type="button"
          disabled={loading}
          onClick={() => generate({ videoId, type: defaultNoteType, chunks, videoTitle: title ?? undefined })}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-800 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex gap-1 overflow-x-auto border-b border-neutral-800 px-3 py-2">
          {NOTE_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={loading}
              onClick={() => generate({ videoId, type: t.id, chunks, videoTitle: title ?? undefined })}
              className="shrink-0 rounded-md border border-neutral-800 px-2 py-1 text-[10px] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-40"
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="border-b border-neutral-800 p-4">
            <Loader label="Generating notes…" />
          </div>
        )}
        {error && <ErrorBanner message={error} />}

        <div className="flex min-h-0 flex-1">
          <aside className="w-[34%] shrink-0 overflow-y-auto border-r border-neutral-800 p-2">
            {notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setSelected(n.id);
                  setEditing(false);
                }}
                className={twMerge(
                  clsx(
                    'mb-1 w-full rounded-lg px-2.5 py-2 text-left',
                    active?.id === n.id ? 'bg-neutral-800 ring-1 ring-neutral-700' : 'hover:bg-neutral-900'
                  )
                )}
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-neutral-500" />
                  <span className="truncate text-[11px] font-medium capitalize text-neutral-200">{n.type}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-neutral-500">{n.title}</p>
              </button>
            ))}
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {active ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-white">{active.title}</h3>
                    <p className="text-[11px] capitalize text-neutral-500">{active.type}</p>
                  </div>
                  <div className="flex gap-1">
                    {editing ? (
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        className="rounded-md border border-neutral-700 p-1.5 text-neutral-300 hover:bg-neutral-800"
                        aria-label="Save note"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="rounded-md border border-neutral-700 p-1.5 text-neutral-400 hover:bg-neutral-800"
                        aria-label="Edit note"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(active.id, videoId)}
                      className="rounded-md border border-neutral-700 p-1.5 text-neutral-500 hover:text-red-400"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-h-[280px] w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 font-mono text-sm leading-relaxed text-neutral-200 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                    aria-label="Edit note content"
                  />
                ) : (
                  <div className="space-y-2">
                    {sections.map((sec) => (
                      <CollapsibleSection key={sec.title} title={sec.title} defaultOpen>
                        <MarkdownView content={sec.body} variant="notes" />
                      </CollapsibleSection>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="py-12 text-center text-sm text-neutral-500">Generate your first note set</p>
            )}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
