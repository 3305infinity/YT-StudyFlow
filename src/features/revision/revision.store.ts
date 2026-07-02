import { create } from 'zustand';
import type { Flashcard, QuizQuestion, SemanticChunk } from '@/types/ai';
import {
  generateFlashcardsForVideo,
  listFlashcards,
  gradeFlashcard,
} from './flashcards';
import { generateQuizForVideo, loadLatestQuiz } from './quiz';
import { useAnalyticsStore } from '@/store/analytics.store';

interface RevisionState {
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  loading: boolean;
  error: string | null;
  flipped: boolean;
  currentCardIndex: number;
  quizIndex: number;
  quizAnswers: Record<string, number>;
  load: (videoId: string) => Promise<void>;
  generateFlashcards: (p: {
    videoId: string;
    chunks: SemanticChunk[];
    videoTitle?: string;
  }) => Promise<void>;
  generateQuiz: (p: {
    videoId: string;
    chunks: SemanticChunk[];
    videoTitle?: string;
  }) => Promise<void>;
  grade: (cardId: string, grade: 'again' | 'hard' | 'good' | 'easy') => Promise<void>;
  setFlipped: (v: boolean) => void;
  nextCard: () => void;
  prevCard: () => void;
  setQuizAnswer: (questionId: string, optionIndex: number) => void;
  nextQuizQuestion: () => void;
  prevQuizQuestion: () => void;
  getQuizScore: () => { correct: number; total: number; answered: number };
  getFlashcardStats: () => { dueToday: number; total: number; reviewed: number };
}

export const useRevisionStore = create<RevisionState>((set, get) => ({
  flashcards: [],
  quiz: [],
  loading: false,
  error: null,
  flipped: false,
  currentCardIndex: 0,
  quizIndex: 0,
  quizAnswers: {},

  load: async (videoId) => {
    set({ loading: true });
    try {
      const [flashcards, quiz] = await Promise.all([
        listFlashcards(videoId),
        loadLatestQuiz(videoId),
      ]);
      set({ flashcards, quiz, loading: false, currentCardIndex: 0, quizIndex: 0 });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  generateFlashcards: async ({ videoId, chunks, videoTitle }) => {
    set({ loading: true, error: null });
    try {
      const flashcards = await generateFlashcardsForVideo({
        videoId,
        semanticChunks: chunks,
        videoTitle,
      });
      set({ flashcards, loading: false, currentCardIndex: 0 });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  generateQuiz: async ({ videoId, chunks, videoTitle }) => {
    set({ loading: true, error: null });
    try {
      const quiz = await generateQuizForVideo({
        videoId,
        semanticChunks: chunks,
        videoTitle,
      });
      set({ quiz, loading: false, quizAnswers: {}, quizIndex: 0 });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  grade: async (cardId, grade) => {
    await gradeFlashcard(cardId, grade);
    const videoId = get().flashcards[0]?.videoId;
    if (videoId) {
      const flashcards = await listFlashcards(videoId);
      const reviewed = flashcards.filter((f) => f.lastReviewed).length;
      useAnalyticsStore.getState().setFlashcardsReviewed(reviewed);
      set({ flashcards, flipped: false });
    }
  },

  setFlipped: (flipped) => set({ flipped }),
  nextCard: () =>
    set((s) => ({
      currentCardIndex: Math.min(s.currentCardIndex + 1, s.flashcards.length - 1),
      flipped: false,
    })),
  prevCard: () =>
    set((s) => ({
      currentCardIndex: Math.max(s.currentCardIndex - 1, 0),
      flipped: false,
    })),

  setQuizAnswer: (questionId, optionIndex) => {
    set((s) => {
      const quizAnswers = { ...s.quizAnswers, [questionId]: optionIndex };
      const quiz = s.quiz;
      let correct = 0;
      let answered = 0;
      for (const q of quiz) {
        if (quizAnswers[q.id] != null) {
          answered += 1;
          if (quizAnswers[q.id] === q.correctAnswer) correct += 1;
        }
      }
      const accuracy = answered ? correct / answered : null;
      useAnalyticsStore.getState().setQuizAccuracy(accuracy);
      return { quizAnswers };
    });
  },

  nextQuizQuestion: () =>
    set((s) => ({
      quizIndex: Math.min(s.quizIndex + 1, Math.max(0, s.quiz.length - 1)),
    })),

  prevQuizQuestion: () =>
    set((s) => ({
      quizIndex: Math.max(s.quizIndex - 1, 0),
    })),

  getQuizScore: () => {
    const { quiz, quizAnswers } = get();
    let correct = 0;
    let answered = 0;
    for (const q of quiz) {
      if (quizAnswers[q.id] != null) {
        answered += 1;
        if (quizAnswers[q.id] === q.correctAnswer) correct += 1;
      }
    }
    return { correct, total: quiz.length, answered };
  },

  getFlashcardStats: () => {
    const { flashcards } = get();
    const now = Date.now();
    const dueToday = flashcards.filter((f) => f.nextReviewDate <= now).length;
    const reviewed = flashcards.filter((f) => f.lastReviewed).length;
    return { dueToday, total: flashcards.length, reviewed };
  },
}));
