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
          <div className="flex rounded-lg border border-neutral-800 p-0.5">
          {(['flashcards', 'quiz'] as RevisionTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={twMerge(
                clsx(
                  'rounded-md px-2.5 py-1 text-[10px] font-medium capitalize',
                  tab === t ? 'bg-neutral-800 text-white' : 'text-neutral-500'
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
        <div className="border-b border-neutral-800 px-4 py-2">
          {tab === 'flashcards' ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => generateFlashcards({ videoId, chunks, videoTitle: title ?? undefined })}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
            >
              {flashcards.length ? 'Regenerate deck' : 'Generate flashcards'}
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => generateQuiz({ videoId, chunks, videoTitle: title ?? undefined })}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
            >
              {quiz.length ? 'Regenerate quiz' : 'Generate quiz'}
            </button>
          )}
        </div>

        {loading && (
          <div className="border-b border-neutral-800 p-4">
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
                  <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      {currentCardIndex + 1} / {flashcards.length}
                    </span>
                    <div className="h-1 flex-1 mx-3 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all"
                        style={{
                          width: `${((currentCardIndex + 1) / flashcards.length) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={prevCard} disabled={currentCardIndex <= 0} className="rounded p-1 hover:bg-neutral-800 disabled:opacity-30">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={nextCard} disabled={currentCardIndex >= flashcards.length - 1} className="rounded p-1 hover:bg-neutral-800 disabled:opacity-30">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFlipped(!flipped)}
                    className={twMerge(
                      clsx(
                        'relative w-full min-h-[200px] rounded-xl border p-6 text-left transition-all duration-500 [transform-style:preserve-3d]',
                        flipped
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-neutral-700 bg-neutral-900/60 hover:border-neutral-600'
                      )
                    )}
                    style={{ perspective: '1000px' }}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                      {flipped ? 'Answer' : 'Question'}
                    </p>
                    <p className="mt-3 text-base leading-7 text-white">{flipped ? card.back : card.front}</p>
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
                          className="rounded-lg border border-neutral-700 py-2.5 text-[11px] font-medium text-neutral-300 hover:bg-neutral-800"
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
                <div className="mb-4 flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2">
                  <span className="text-xs text-neutral-400">
                    Score: {score.correct}/{score.answered} answered
                  </span>
                  <span className="text-xs text-neutral-500">
                    Q{quizIndex + 1} of {quiz.length}
                  </span>
                </div>
              )}

              {quizQuestion ? (
                <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                  <p className="text-sm font-medium text-white">{quizQuestion.question}</p>
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
                                ? 'border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/60'
                                : isPicked
                                  ? isCorrect
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                                    : 'border-red-500/40 bg-red-500/10 text-red-100'
                                  : isCorrect
                                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200/80'
                                    : 'border-neutral-800 text-neutral-600'
                            )
                          )}
                        >
                          <span className="font-mono text-neutral-500 mr-2">{String.fromCharCode(65 + i)}.</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {quizAnswers[quizQuestion.id] != null && (
                    <div className="mt-4 space-y-2 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                      <p className="text-xs leading-relaxed text-neutral-400">{quizQuestion.explanation}</p>
                      {quizQuestion.timestamp != null && onJumpToTime && (
                        <button
                          type="button"
                          onClick={() => onJumpToTime(quizQuestion.timestamp!)}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300"
                        >
                          Jump to {formatTime(quizQuestion.timestamp)} in transcript
                        </button>
                      )}
                      <p className="text-[10px] text-neutral-600">
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
                      className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={nextQuizQuestion}
                      disabled={quizIndex >= quiz.length - 1}
                      className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-30"
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
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 py-2">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-[10px] text-neutral-500">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Layers; text: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Icon className="h-10 w-10 text-neutral-700" />
      <p className="mt-3 text-sm text-neutral-500">{text}</p>
    </div>
  );
}
