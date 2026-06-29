/**
 * Migration runner — executes SQL files in backend/migrations/ in filename order.
 *
 * Tracking: applied migrations are recorded in admin.schema_migrations so they
 * are never re-run. On a fresh database the tracking table is created automatically.
 *
 * Connection priority:
 *   1. DATABASE_ADMIN_URL  — should point to the postgres superuser; required for
 *      migrations tagged "REQUIRES: run as postgres superuser" (002, 004, …).
 *   2. DATABASE_URL        — falls back to the app role; superuser-tagged migrations
 *      are skipped with a warning if this role is not a superuser.
 *
 * Usage (local):
 *   node backend/scripts/migrate.js
 *
 * In Docker the "migrate" service provides DATABASE_ADMIN_URL automatically.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: join(__dirname, '../.env') });

const { Client } = pg;
const MIGRATIONS_DIR = join(__dirname, '../migrations');
const SUPERUSER_TAG  = 'REQUIRES: run as postgres superuser';

async function run() {
  const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_ADMIN_URL or DATABASE_URL must be set.');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  // Detect superuser
  const { rows: [pgUser] } = await client.query(
    `SELECT usesuper FROM pg_user WHERE usename = current_user`
  );
  const superuser = pgUser?.usesuper === true;

  if (!superuser) {
    console.warn(
      '⚠  Connected as non-superuser — migrations tagged "REQUIRES: run as postgres superuser" will be skipped.\n' +
      '   Set DATABASE_ADMIN_URL=postgresql://postgres:<pw>@<host>:5432/financas to apply all migrations automatically.\n'
    );
  }

  // Bootstrap tracking table (requires superuser or pre-existing admin schema + grants)
  let trackingAvailable = false;
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS admin`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin.schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    trackingAvailable = true;
  } catch (err) {
    console.warn(`⚠  Cannot create admin.schema_migrations (${err.message}) — migration tracking disabled.\n`);
  }

  // Load already-applied migrations
  let appliedSet = new Set();
  if (trackingAvailable) {
    const { rows } = await client.query(`SELECT filename FROM admin.schema_migrations`);
    appliedSet = new Set(rows.map(r => r.filename));
  }

  // Collect and sort migration files
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  } catch {
    console.error(`[migrate] Migrations directory not found: ${MIGRATIONS_DIR}`);
    await client.end();
    process.exit(1);
  }

  if (!files.length) {
    console.log('[migrate] No migration files found — nothing to do.');
    await client.end();
    return;
  }

  const skipped = [];

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ↷  ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

    if (sql.includes(SUPERUSER_TAG) && !superuser) {
      console.warn(`  ⚠  ${file}: requires superuser — skipped`);
      skipped.push(file);
      continue;
    }

    process.stdout.write(`  ▶  ${file} ... `);
    try {
      await client.query(sql);
      if (trackingAvailable) {
        await client.query(
          `INSERT INTO admin.schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
          [file]
        );
      }
      console.log('✓');
    } catch (err) {
      console.error(`✗\n     ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  if (skipped.length) {
    console.warn(
      `\n⚠  ${skipped.length} migration(s) skipped — run manually as postgres superuser:\n` +
      skipped.map(f => `     docker compose exec db psql -U postgres -d financas -f /migrations/${f}`).join('\n') +
      '\n\n   Or set DATABASE_ADMIN_URL in your environment and re-run this script.\n'
    );
  }

  console.log('\n[migrate] Done.');
  await client.end();
}

run().catch(err => {
  console.error('[migrate]', err.message);
  process.exit(1);
});
