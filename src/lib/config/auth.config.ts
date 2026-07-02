/**
 * TODO: Re-enable authentication — set AUTH_DISABLED to false and restore sign-in flow
 * in Settings, FeatureGate, auth.store, and api/client.ts.
 */
export const AUTH_DISABLED = true;

/** Must match backend GUEST_USER_ID when auth is disabled. */
export const GUEST_USER_ID = 'guest-local-user';
