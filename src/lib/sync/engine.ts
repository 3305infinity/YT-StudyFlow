import { checkBackendHealth } from '@lib/api/client';
import { AUTH_DISABLED } from '@lib/config/auth.config';
import { CLOUD_SYNC_DISABLED } from '@lib/config/sync.config';

let syncInFlight: Promise<void> | null = null;

export function mergeWinner(localUpdatedAt: number, remoteUpdatedAt: number): 'local' | 'remote' {
  return remoteUpdatedAt >= localUpdatedAt ? 'remote' : 'local';
}

/**
 * Gate for all cloud push/pull operations.
 * TODO: Re-enable when CLOUD_SYNC_DISABLED=false and AUTH_DISABLED=false.
 */
export async function canSync(): Promise<boolean> {
  if (CLOUD_SYNC_DISABLED) return false;
  if (AUTH_DISABLED) return checkBackendHealth();
  const { isAuthenticated } = await import('@lib/api/auth');
  return (await isAuthenticated()) && (await checkBackendHealth());
}

async function safeSync(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.warn(`[YT StudyFlow] sync ${label} failed`, err);
  }
}

/** Full push/pull sync — no-op when cloud sync is disabled. */
export async function runSync(): Promise<void> {
  if (!(await canSync())) return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const { pushDirtyNotes, pullNotes } = await import('./notes.sync');
    const { pushDirtyFlashcards, pullFlashcards } = await import('./flashcards.sync');
    const { pushDirtyQuizzes, pullQuizzes } = await import('./quizzes.sync');
    const { pushDirtyHistory, pullHistory } = await import('./history.sync');
    const { pushDirtyPlaylists, pullPlaylists } = await import('./playlists.sync');
    const { pushDirtyStudySessions, pullStudySessions } = await import('./studySessions.sync');

    await safeSync('notes push', () => pushDirtyNotes());
    await safeSync('flashcards push', () => pushDirtyFlashcards());
    await safeSync('quizzes push', () => pushDirtyQuizzes());
    await safeSync('history push', () => pushDirtyHistory());
    await safeSync('playlists push', () => pushDirtyPlaylists());
    await safeSync('studySessions push', () => pushDirtyStudySessions());

    await safeSync('notes pull', () => pullNotes());
    await safeSync('flashcards pull', () => pullFlashcards());
    await safeSync('quizzes pull', () => pullQuizzes());
    await safeSync('history pull', () => pullHistory());
    await safeSync('playlists pull', () => pullPlaylists());
    await safeSync('studySessions pull', () => pullStudySessions());
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

/** Fire-and-forget sync — skipped when CLOUD_SYNC_DISABLED. */
export function scheduleSync(): void {
  if (CLOUD_SYNC_DISABLED) return;
  void runSync();
}

/** TODO: Re-enable online listener when CLOUD_SYNC_DISABLED=false. */
export function initSyncOnlineListener(): void {
  if (CLOUD_SYNC_DISABLED) return;
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    void runSync();
  });
}

export async function syncVideoScope(youtubeVideoId: string): Promise<void> {
  if (!(await canSync())) return;
  const { pullNotes, pushDirtyNotes } = await import('./notes.sync');
  const { pullFlashcards, pushDirtyFlashcards } = await import('./flashcards.sync');
  const { pullQuizzes, pushDirtyQuizzes } = await import('./quizzes.sync');
  const { pullHistory, pushDirtyHistory } = await import('./history.sync');

  await safeSync('notes push', () => pushDirtyNotes(youtubeVideoId));
  await safeSync('flashcards push', () => pushDirtyFlashcards({ videoId: youtubeVideoId }));
  await safeSync('quizzes push', () => pushDirtyQuizzes(youtubeVideoId));
  await safeSync('history push', () => pushDirtyHistory(youtubeVideoId));

  await safeSync('notes pull', () => pullNotes(youtubeVideoId));
  await safeSync('flashcards pull', () => pullFlashcards({ videoId: youtubeVideoId }));
  await safeSync('quizzes pull', () => pullQuizzes(youtubeVideoId));
  await safeSync('history pull', () => pullHistory(youtubeVideoId));
}

export async function syncPlaylistScope(playlistId: string): Promise<void> {
  if (!(await canSync())) return;
  const { pullFlashcards, pushDirtyFlashcards } = await import('./flashcards.sync');
  const { pullStudySessions, pushDirtyStudySessions } = await import('./studySessions.sync');
  const { pullPlaylists, pushDirtyPlaylists } = await import('./playlists.sync');

  await safeSync('playlists push', () => pushDirtyPlaylists());
  await safeSync('flashcards push', () => pushDirtyFlashcards({ playlistId }));
  await safeSync('studySessions push', () => pushDirtyStudySessions(playlistId));

  await safeSync('playlists pull', () => pullPlaylists());
  await safeSync('flashcards pull', () => pullFlashcards({ playlistId }));
  await safeSync('studySessions pull', () => pullStudySessions(playlistId));
}
