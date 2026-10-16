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
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLACEHOLDER = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE_DIR = path.join(BACKEND_ROOT, 'node_modules', '.prisma', 'client');

/**
 * Removes half-written engine files left behind by an interrupted generate.
 *
 * Prisma writes the query engine to `query_engine-*.tmp<pid>` and then renames it over
 * the real file. On Windows that rename intermittently fails with EPERM (an antivirus
 * or indexer holding the fresh file open for a moment). Every failure leaves its .tmp
 * behind, and once a few have piled up the next generate keeps failing, which makes
 * plain `npm install` exit 1. They are pure garbage, so clear them first.
 */
function removeStaleEngineTempFiles() {
  if (!existsSync(ENGINE_DIR)) return;

  let removed = 0;
  for (const name of readdirSync(ENGINE_DIR)) {
    if (!/\.tmp\d+$/.test(name)) continue;
    try {
      rmSync(path.join(ENGINE_DIR, name), { force: true });
      removed++;
    } catch {
      // Still locked — leave it; prisma may well succeed anyway.
    }
  }

  if (removed > 0) {
    console.log(`[prisma] Cleared ${removed} stale engine temp file(s) before generating.`);
  }
}

removeStaleEngineTempFiles();

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
