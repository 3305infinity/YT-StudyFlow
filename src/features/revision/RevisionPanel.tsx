import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useRevisionStore } from './revision.store';
import { useRagStore } from '@/store/rag.store';
import { useVideoStore } from '@/store/video.store';
import { Loader } from '@/components/Loader';
import { FeatureGate } from '@/components/FeatureGate';
import { WorkspaceShell } from '@/components/WorkspaceShell';
import { useAiReadiness } from '@/hooks/useAiReadiness';
import { formatTime } from '@lib/youtube';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LanguageBadge } from '@/components/LanguageSelector';

type RevisionTab = 'flashcards' | 'quiz';

export function RevisionPanel({
  videoId,
  onJumpToTime,
}: {
  videoId: string;
  onJumpToTime?: (seconds: number) => void;
}) {
  const [tab, setTab] = useState<RevisionTab>('flashcards');
  const {
    flashcards,
    quiz,
    loading,
    error,
    flipped,
    currentCardIndex,
    quizIndex,
    quizAnswers,
    load,
    generateFlashcards,
    generateQuiz,
    grade,
    setFlipped,
    nextCard,
    prevCard,
    setQuizAnswer,
    nextQuizQuestion,
    prevQuizQuestion,
    getQuizScore,
    getFlashcardStats,
  } = useRevisionStore();
  const chunks = useRagStore((s) => s.chunks);
  const title = useVideoStore((s) => s.title);
  const readiness = useAiReadiness();

  useEffect(() => {
    void load(videoId);
  }, [videoId, load]);

  const card = flashcards[currentCardIndex];
  const quizQuestion = quiz[quizIndex];
  const score = getQuizScore();
  const fcStats = getFlashcardStats();

  if (readiness.state !== 'ready') {
    return <FeatureGate>{null}</FeatureGate>;
  }

  return (
    <WorkspaceShell
      title="Revision"
      subtitle="Spaced repetition flashcards and adaptive quizzes"
      actions={
        <>
          <LanguageBadge />
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {(['flashcards', 'quiz'] as RevisionTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={twMerge(
                clsx(
                  'rounded-md px-2.5 py-1 text-[10px] font-medium capitalize transition-all',
                  tab === t ? 'bg-brand-gradient text-white shadow-cta font-semibold' : 'text-content-subtle hover:text-content'
                )
              )}
            >
              {t}
            </button>
          ))}
          </div>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-line px-4 py-2">
          {tab === 'flashcards' ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => generateFlashcards({ videoId, chunks, videoTitle: title ?? undefined })}
              className="text-xs font-semibold text-brand hover:underline disabled:opacity-40"
            >
              {flashcards.length ? 'Regenerate deck' : 'Generate flashcards'}
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => generateQuiz({ videoId, chunks, videoTitle: title ?? undefined })}
              className="text-xs font-semibold text-brand hover:underline disabled:opacity-40"
            >
              {quiz.length ? 'Regenerate quiz' : 'Generate quiz'}
            </button>
          )}
        </div>

        {loading && (
          <div className="border-b border-line p-4">
            <Loader label="Generating…" />
          </div>
        )}
        {error && <ErrorBanner message={error} />}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'flashcards' && (
            <>
              {flashcards.length > 0 && (
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <StatPill label="Due today" value={fcStats.dueToday} />
                  <StatPill label="Reviewed" value={fcStats.reviewed} />
                  <StatPill label="Total" value={fcStats.total} />
                </div>
              )}

              {card ? (
                <section>
                  <div className="mb-3 flex items-center justify-between text-xs text-content-subtle">
                    <span>
                      {currentCardIndex + 1} / {flashcards.length}
                    </span>
                    <div className="h-1 flex-1 mx-3 rounded-full bg-surface-raised overflow-hidden">
                      <div
                        className="h-full bg-brand transition-all"
                        style={{
                          width: `${((currentCardIndex + 1) / flashcards.length) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={prevCard} disabled={currentCardIndex <= 0} className="rounded p-1 text-content-subtle hover:bg-surface-raised hover:text-content disabled:opacity-30">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={nextCard} disabled={currentCardIndex >= flashcards.length - 1} className="rounded p-1 text-content-subtle hover:bg-surface-raised hover:text-content disabled:opacity-30">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFlipped(!flipped)}
                    className={twMerge(
                      clsx(
                        'relative w-full min-h-[200px] rounded-xl border p-6 text-left transition-all duration-300 [transform-style:preserve-3d]',
                        flipped
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-content'
                          : 'border-line bg-surface-raised hover:border-line-strong hover:bg-surface-overlay'
                      )
                    )}
                    style={{ perspective: '1000px' }}
                  >
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-content-subtle">
                      {flipped ? 'Answer' : 'Question'}
                    </p>
                    <p className="mt-3 text-base leading-7 text-content font-medium">{flipped ? card.back : card.front}</p>
                  </button>

                  {flipped && (
                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      {([
                        ['again', 'Again'],
                        ['hard', 'Hard'],
                        ['good', 'Good'],
                        ['easy', 'Easy'],
                      ] as const).map(([g, label]) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => grade(card.id, g)}
                          className="rounded-lg border border-line bg-surface py-2.5 text-[11px] font-medium text-content-muted hover:bg-surface-raised hover:text-content transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                !loading && (
                  <EmptyState icon={Layers} text="Generate flashcards to start reviewing" />
                )
              )}
            </>
          )}

          {tab === 'quiz' && (
            <>
              {quiz.length > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-surface-raised px-3 py-2">
                  <span className="text-xs text-content-muted">
                    Score: {score.correct}/{score.answered} answered
                  </span>
                  <span className="text-xs text-content-subtle">
                    Q{quizIndex + 1} of {quiz.length}
                  </span>
                </div>
              )}

              {quizQuestion ? (
                <section className="rounded-xl border border-line bg-surface-raised/50 p-4">
                  <p className="text-sm font-semibold text-content">{quizQuestion.question}</p>
                  <div className="mt-4 space-y-2">
                    {quizQuestion.options.map((opt, i) => {
                      const picked = quizAnswers[quizQuestion.id];
                      const isPicked = picked === i;
                      const isCorrect = i === quizQuestion.correctAnswer;
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={picked != null}
                          onClick={() => setQuizAnswer(quizQuestion.id, i)}
                          className={twMerge(
                            clsx(
                              'block w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                              picked == null
                                ? 'border-line text-content-muted hover:border-line-strong hover:bg-surface-overlay hover:text-content'
                                : isPicked
                                  ? isCorrect
                                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold'
                                    : 'border-danger/40 bg-danger/15 text-danger font-semibold'
                                  : isCorrect
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-medium'
                                    : 'border-line text-content-subtle opacity-60'
                            )
                          )}
                        >
                          <span className="font-mono text-content-subtle mr-2">{String.fromCharCode(65 + i)}.</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {quizAnswers[quizQuestion.id] != null && (
                    <div className="mt-4 space-y-2 rounded-lg border border-line bg-surface p-3">
                      <p className="text-xs leading-relaxed text-content-muted">{quizQuestion.explanation}</p>
                      {quizQuestion.timestamp != null && onJumpToTime && (
                        <button
                          type="button"
                          onClick={() => onJumpToTime(quizQuestion.timestamp!)}
                          className="text-[11px] font-semibold text-brand hover:underline"
                        >
                          Jump to {formatTime(quizQuestion.timestamp)} in transcript
                        </button>
                      )}
                      <p className="text-[10px] text-content-subtle">
                        Confidence:{' '}
                        {quizAnswers[quizQuestion.id] === quizQuestion.correctAnswer ? 'High' : 'Review needed'}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={prevQuizQuestion}
                      disabled={quizIndex <= 0}
                      className="text-xs text-content-subtle hover:text-content disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={nextQuizQuestion}
                      disabled={quizIndex >= quiz.length - 1}
                      className="text-xs font-semibold text-brand hover:underline disabled:opacity-30"
                    >
                      Next question
                    </button>
                  </div>
                </section>
              ) : (
                !loading && <EmptyState icon={RotateCcw} text="Generate a quiz to test your knowledge" />
              )}
            </>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface-raised py-2">
      <p className="text-lg font-bold text-content">{value}</p>
      <p className="text-[10px] text-content-subtle">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Layers; text: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Icon className="h-10 w-10 text-content-subtle" />
      <p className="mt-3 text-sm text-content-subtle">{text}</p>
    </div>
  );
}
