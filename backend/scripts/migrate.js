/**
 * Migration runner — executes all SQL files in backend/migrations/
 * in ascending filename order.
 *
 * Usage:
 *   node backend/scripts/migrate.js
 *
 * Requires DATABASE_URL in backend/.env (or environment).
 * Must be run as a PostgreSQL superuser the first time (to create roles).
 *
 * Migrations that contain the tag "REQUIRES: run as postgres superuser"
 * are skipped when the connected role is not a superuser, with a warning
 * instead of a hard failure — they must be applied manually.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../migrations');

const SUPERUSER_TAG = 'REQUIRES: run as postgres superuser';

async function isSuperuser(client) {
  const { rows } = await client.query(
    `SELECT usesuper FROM pg_user WHERE usename = current_user`
  );
  return rows[0]?.usesuper === true;
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const superuser = await isSuperuser(client);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (!files.length) {
    console.log('No migration files found.');
    await client.end();
    return;
  }

  const skipped = [];

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    const needsSuperuser = sql.includes(SUPERUSER_TAG);

    if (needsSuperuser && !superuser) {
      console.warn(`  ⚠ ${file}: requires superuser — skipped (run manually as postgres)`);
      skipped.push(file);
      continue;
    }

    console.log(`Running ${file}...`);
    try {
      await client.query(sql);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  if (skipped.length) {
    console.warn(`\n⚠ ${skipped.length} migration(s) skipped — must be run as postgres superuser:`);
    skipped.forEach(f => console.warn(`    psql -U postgres -d financas -f backend/migrations/${f}`));
  }

  console.log('\nMigrations complete.');
  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
