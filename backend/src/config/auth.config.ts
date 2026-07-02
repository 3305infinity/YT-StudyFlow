/**
 * TODO: Re-enable authentication — set AUTH_DISABLED to false and restore Clerk JWT
 * verification in middleware/auth.ts.
 */
export const AUTH_DISABLED = process.env.AUTH_DISABLED !== 'false';

/** Stable user id used while auth is disabled (Pinecone namespaces, sync, quotas). */
export const GUEST_USER_ID = process.env.GUEST_USER_ID?.trim() || 'guest-local-user';
