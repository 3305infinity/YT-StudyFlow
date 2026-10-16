/**
 * Runs `prisma generate` in deployments that have no database configured.
 *
 * The Prisma client has to be generated for the server to import @prisma/client at all,
 * but `prisma generate` refuses to run unless DATABASE_URL and DIRECT_URL are *present*
 * in the environment — even though it never connects. This deployment treats the
 * database as optional (every repository no-ops when DATABASE_URL is unset, see
 * src/repositories/*.ts), so on a fresh Render build neither variable exists and the
 * build would fail with P1012.
 *
 * We therefore substitute syntactically-valid placeholders when, and only when, the real
 * values are missing. Nothing connects to them: a placeholder here means the database
 * stays disabled at runtime, which is the intended behaviour.
 */

import { spawnSync } from 'node:child_process';

const PLACEHOLDER = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

const usingPlaceholder = !process.env.DATABASE_URL?.trim();
if (usingPlaceholder) {
  process.env.DATABASE_URL = PLACEHOLDER;
  console.log(
    '[prisma] DATABASE_URL not set — generating the client with a placeholder URL. ' +
      'Database-backed features (cloud sync, usage quotas) stay disabled at runtime.'
  );
}

// directUrl is only used by Prisma Migrate; mirror DATABASE_URL when it is absent.
if (!process.env.DIRECT_URL?.trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const result = spawnSync('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (result.error) {
  console.error('[prisma] Failed to run prisma generate:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
