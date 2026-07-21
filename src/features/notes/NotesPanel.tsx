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
import { Button } from '@/components/Button';

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
          <Button
            type="button"
            disabled={loading}
            onClick={() => generate({ videoId, type: defaultNoteType, chunks, videoTitle: title ?? undefined })}
            size="sm"
          >
            <Plus className="h-3 w-3" />
            New
          </Button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
          {NOTE_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={loading}
              onClick={() => generate({ videoId, type: t.id, chunks, videoTitle: title ?? undefined })}
              className="shrink-0 rounded-md border border-line bg-surface px-2.5 py-1.5 text-caption font-medium text-content-subtle transition-colors duration-170 ease-out hover:border-line-strong hover:text-content disabled:opacity-40"
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="border-b border-line px-4 py-4">
            <Loader label="Generating notes…" />
          </div>
        )}
        {error && <ErrorBanner message={error} />}

        <div className="flex min-h-0 flex-1">
          <aside className="w-[38%] shrink-0 overflow-y-auto border-r border-line p-3">
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
                    'mb-1.5 w-full rounded-lg px-3 py-2.5 text-left transition-colors duration-170 ease-out',
                    active?.id === n.id
                      ? 'bg-surface-overlay border border-line-strong'
                      : 'border border-transparent hover:bg-surface-overlay'
                  )
                )}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-content-subtle" />
                  <span className="truncate text-[11px] font-medium capitalize text-content">{n.type}</span>
                </div>
                <p className="mt-1 truncate text-caption text-content-subtle">{n.title}</p>
              </button>
            ))}
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {active ? (
              <>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-heading font-semibold tracking-tight text-content">{active.title}</h3>
                    <p className="mt-1 text-caption text-content-subtle capitalize">{active.type}</p>
                  </div>
                  <div className="flex gap-1">
                    {editing ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleSave()}
                        aria-label="Save note"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(true)}
                        aria-label="Edit note"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="danger"
                      size="icon"
                      onClick={() => remove(active.id, videoId)}
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-h-[280px] w-full rounded-lg border border-line bg-surface px-3 py-3 font-mono text-sm leading-relaxed text-content placeholder:text-content-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
                    aria-label="Edit note content"
                  />
                ) : (
                  <div className="space-y-3">
                    {sections.map((sec) => (
                      <CollapsibleSection key={sec.title} title={sec.title} defaultOpen>
                        <MarkdownView content={sec.body} variant="notes" />
                      </CollapsibleSection>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="ds-card flex flex-col items-center justify-center px-6 py-12 text-center">
                <p className="text-heading text-content">Generate your first note set</p>
                <p className="mt-1.5 text-caption text-content-subtle">
                  Select a note type above to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
