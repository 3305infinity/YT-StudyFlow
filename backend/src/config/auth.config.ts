/**
 * TODO: Re-enable authentication — set AUTH_DISABLED to false and restore Clerk JWT
 * verification in middleware/auth.ts.
 */
export const AUTH_DISABLED = process.env.AUTH_DISABLED !== 'false';

/**
 * Display-only guest id. Must stay in sync with GUEST_USER_ID in
 * src/lib/config/auth.config.ts (extension). Not configurable via env so the two
 * sides cannot drift apart.
 *
 * NOTE: this is NOT used to scope data or quotas. Anonymous callers are identified
 * per installation (`anon:<uuid>` from the X-Install-Id header) or by IP — see
 * middleware/auth.ts.
 */
export const GUEST_USER_ID = 'guest-local-user';

/** Prefix for per-installation anonymous user ids. */
export const ANON_USER_PREFIX = 'anon:';

/** Prefix for IP-derived anonymous user ids (used when no install id is sent). */
export const ANON_IP_PREFIX = 'ip:';
