/**
 * Migration runner — executes all SQL files in backend/migrations/
 * in ascending filename order.
 *
 * Usage:
 *   node backend/scripts/migrate.js
 *
 * Requires DATABASE_URL in backend/.env (or environment).
 * Must be run as a PostgreSQL superuser the first time (to create roles).
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../migrations');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (!files.length) {
    console.log('No migration files found.');
    await client.end();
    return;
  }

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
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

  console.log('\nAll migrations applied.');
  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
