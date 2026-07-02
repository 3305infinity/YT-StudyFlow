import type { ResponseLanguageId } from '@lib/languages';
import { useNotesStore } from '@/features/notes/notes.store';
import { useRevisionStore } from '@/features/revision/revision.store';
import { useRagStore } from '@/store/rag.store';
import { useVideoStore } from '@/store/video.store';
import { useTranscriptStore } from '@/features/transcript/transcript.store';

/**
 * Side effects when the global AI language preference changes.
 * Regenerates AI content for the active video when cached content exists.
 */
export async function handleGlobalLanguageChange(
  language: ResponseLanguageId,
  previous: ResponseLanguageId
): Promise<void> {
  if (language === previous) return;

  const videoId = useVideoStore.getState().videoId;
  if (!videoId) return;

  const videoTitle = useVideoStore.getState().title ?? undefined;
  const chunks = useRagStore.getState().chunks;
  const transcriptState = useTranscriptStore.getState();
  const wasTranslated = transcriptState.viewMode === 'translated';

  useTranscriptStore.setState((state) => {
    const displayChunks = state.enhancedChunks;
    const q = state.searchQuery.trim().toLowerCase();
    const filteredChunks = q
      ? displayChunks.filter((c) => c.text.toLowerCase().includes(q))
      : displayChunks;
    return {
      translatedChunks: [],
      translationLanguage: null,
      viewMode: 'original' as const,
      displayChunks,
      filteredChunks,
    };
  });

  if (wasTranslated && transcriptState.enhancedChunks.length > 0) {
    await useTranscriptStore.getState().loadTranslation(language);
  }

  const notesState = useNotesStore.getState();
  if (notesState.notes.length > 0 && chunks.length > 0) {
    const latest = notesState.notes[0];
    if (latest) {
      await notesState.generate({
        videoId,
        type: latest.type,
        chunks,
        videoTitle,
      });
    }
  }

  const revisionState = useRevisionStore.getState();
  if (revisionState.flashcards.length > 0 && chunks.length > 0) {
    await revisionState.generateFlashcards({ videoId, chunks, videoTitle });
  }
  if (revisionState.quiz.length > 0 && chunks.length > 0) {
    await revisionState.generateQuiz({ videoId, chunks, videoTitle });
  }
}
