/**
 * One-time migration: imports backend/data/db.json into a provisioned tenant schema.
 *
 * Usage:
 *   IMPORT_TENANT_SCHEMA=tenant_acme node backend/scripts/importDbJson.js
 *
 * Prerequisites:
 *   1. Migrations have been run (node backend/scripts/migrate.js)
 *   2. The tenant has been provisioned:
 *      psql -c "SELECT admin.provision_tenant('acme', 'Acme Ltda');"
 *   3. DATABASE_URL is set in backend/.env
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_JSON_PATH = join(__dirname, '../data/db.json');

const TENANT_SCHEMA = process.env.IMPORT_TENANT_SCHEMA;
if (!TENANT_SCHEMA) {
  console.error('Error: IMPORT_TENANT_SCHEMA environment variable is required.');
  console.error('Example: IMPORT_TENANT_SCHEMA=tenant_acme node scripts/importDbJson.js');
  process.exit(1);
}

if (!/^tenant_[a-z][a-z0-9_]{1,62}$/.test(TENANT_SCHEMA)) {
  console.error(`Error: Invalid schema name "${TENANT_SCHEMA}". Must match tenant_<slug>.`);
  process.exit(1);
}

if (!existsSync(DB_JSON_PATH)) {
  console.error(`Error: db.json not found at ${DB_JSON_PATH}`);
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const db = JSON.parse(readFileSync(DB_JSON_PATH, 'utf-8'));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO "${TENANT_SCHEMA}"`);

    // 1. plano
    const plano = db.plano || [];
    console.log(`Importing ${plano.length} plano items...`);
    for (const item of plano) {
      await client.query(
        `INSERT INTO plano (tipo, grp, cat, nivel)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tipo) DO NOTHING`,
        [item.tipo, item.grp || item.grupo, item.cat || item.categoria, item.nivel]
      );
    }

    // 2. planoCores
    const planoCores = db.planoCores || {};
    console.log(`Importing ${Object.keys(planoCores).length} plano_cores entries...`);
    for (const [cat, cor] of Object.entries(planoCores)) {
      await client.query(
        `INSERT INTO plano_cores (cat, cor) VALUES ($1, $2)
         ON CONFLICT (cat) DO UPDATE SET cor = EXCLUDED.cor`,
        [cat, cor]
      );
    }

    // 3. saldosIniciais
    const saldos = db.saldosIniciais || {};
    console.log(`Importing ${Object.keys(saldos).length} saldo entries...`);
    for (const [chave, valor] of Object.entries(saldos)) {
      await client.query(
        `INSERT INTO saldos_iniciais (chave, valor) VALUES ($1, $2)
         ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
        [chave, String(valor)]
      );
    }

    // 4. transactions — flatten caixa + competencia
    const caixa       = (db.transactions?.caixa       || []);
    const competencia = (db.transactions?.competencia || []);
    const allTx       = [...caixa, ...competencia];
    console.log(`Importing ${allTx.length} transactions (${caixa.length} caixa + ${competencia.length} competência)...`);
    for (const tx of allTx) {
      await client.query(
        `INSERT INTO transactions (data, descricao, cat, grp, tipo, nivel, valor, mov, regime)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tx.data, tx.desc, tx.cat, tx.grp, tx.tipo, tx.nivel, tx.valor, tx.mov, tx.regime]
      );
    }

    // 5. importHistory
    const history = db.importHistory || [];
    console.log(`Importing ${history.length} import history entries...`);
    for (const h of history) {
      await client.query(
        `INSERT INTO import_history (name, rows, base) VALUES ($1, $2, $3)`,
        [h.name, h.rows, h.base]
      );
    }

    await client.query('COMMIT');
    console.log(`\n✓ Migration complete → schema: ${TENANT_SCHEMA}`);
    console.log(`  Transactions : ${allTx.length}`);
    console.log(`  Plano items  : ${plano.length}`);
    console.log(`  Saldo entries: ${Object.keys(saldos).length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
