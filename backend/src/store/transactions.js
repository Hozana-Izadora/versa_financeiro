import { withTenant } from '../db/tenantContext.js';

/**
 * Maps a DB row to the shape the frontend expects.
 * Key difference: DB column is "descricao"; API field is "desc".
 */
function normalizeDate(v) {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString().split('T')[0] : String(v);
}

function normalize(r) {
  return {
    id:              Number(r.id),
    data:            normalizeDate(r.data),
    desc:            r.descricao,
    cat:             r.cat,
    grp:             r.grp,
    tipo:            r.tipo,
    nivel:           r.nivel,
    valor:           Number(r.valor),
    mov:             r.mov,
    regime:          r.regime,
    fornecedor:      r.fornecedor,
    dataEmissao:     normalizeDate(r.data_emissao),
    dataVencimento:  normalizeDate(r.data_vencimento),
    extra:           r.extra ?? {},
  };
}

/**
 * Returns { caixa: [], competencia: [] } — same shape as the old store.
 */
export async function getTransactions(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    const { rows } = await client.query(
      `SELECT id, data, descricao, cat, grp, tipo, nivel, valor, mov, regime,
              fornecedor, data_emissao, data_vencimento, extra
         FROM transactions
        ORDER BY data DESC, id DESC`
    );
    return {
      caixa:       rows.filter(r => r.regime === 'Caixa').map(normalize),
      competencia: rows.filter(r => r.regime === 'Competência').map(normalize),
    };
  });
}

/**
 * Creates a transaction. Returns the created row (including DB-assigned id).
 */
export async function createTransaction(tenantSchema, tx) {
  return withTenant(tenantSchema, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO transactions (
         data, descricao, cat, grp, tipo, nivel, valor, mov, regime,
         fornecedor, data_emissao, data_vencimento, extra
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
       RETURNING *`,
      [
        tx.data, tx.desc, tx.cat, tx.grp, tx.tipo, tx.nivel, tx.valor, tx.mov, tx.regime,
        tx.fornecedor ?? null, tx.dataEmissao ?? null, tx.dataVencimento ?? null,
        JSON.stringify(tx.extra ?? {}),
      ]
    );
    return normalize(rows[0]);
  });
}

/**
 * Updates a transaction. Resolves nivel from the plano table when the tipo changes.
 * Returns the updated row, or null if not found.
 */
export async function updateTransaction(tenantSchema, id, updates) {
  return withTenant(tenantSchema, async (client) => {
    // Resolve nivel from plano for the given tipo
    const planoRow = await client.query(
      `SELECT nivel FROM plano WHERE tipo = $1`,
      [updates.tipo]
    );
    const nivel = planoRow.rows[0]?.nivel ?? updates.nivel;

    const { rows } = await client.query(
      `UPDATE transactions
          SET data             = $1,
              descricao        = $2,
              cat              = $3,
              grp              = $4,
              tipo             = $5,
              nivel            = $6,
              valor            = $7,
              mov              = $8,
              regime           = $9,
              fornecedor       = $10,
              data_emissao     = $11,
              data_vencimento  = $12,
              extra            = $13::jsonb
        WHERE id = $14
        RETURNING *`,
      [
        updates.data, updates.desc, updates.cat, updates.grp, updates.tipo,
        nivel, updates.valor, updates.mov, updates.regime,
        updates.fornecedor ?? null, updates.dataEmissao ?? null, updates.dataVencimento ?? null,
        JSON.stringify(updates.extra ?? {}), id,
      ]
    );
    return rows.length ? normalize(rows[0]) : null;
  });
}

/**
 * Deletes a transaction by id. Returns true if a row was deleted.
 */
export async function deleteTransaction(tenantSchema, id) {
  return withTenant(tenantSchema, async (client) => {
    const { rowCount } = await client.query(
      `DELETE FROM transactions WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  });
}

/**
 * Bulk-inserts transactions (used by import and seed routes).
 * Pass importId to link rows to a specific import batch; null for seed data.
 * Returns the count of inserted rows.
 */
export async function bulkInsertTransactions(tenantSchema, txList, importId = null) {
  if (!txList.length) return 0;
  return withTenant(tenantSchema, async (client) => {
    await client.query(
      `INSERT INTO transactions (
         data, descricao, cat, grp, tipo, nivel, valor, mov, regime, import_id,
         fornecedor, data_emissao, data_vencimento, extra
       )
       SELECT * FROM unnest(
         $1::date[], $2::text[], $3::text[], $4::text[], $5::text[],
         $6::text[], $7::numeric[], $8::text[], $9::text[], $10::bigint[],
         $11::text[], $12::date[], $13::date[], $14::jsonb[]
       ) AS t(data, descricao, cat, grp, tipo, nivel, valor, mov, regime, import_id,
              fornecedor, data_emissao, data_vencimento, extra)`,
      [
        txList.map(t => t.data),
        txList.map(t => t.desc),
        txList.map(t => t.cat),
        txList.map(t => t.grp),
        txList.map(t => t.tipo),
        txList.map(t => t.nivel),
        txList.map(t => t.valor),
        txList.map(t => t.mov),
        txList.map(t => t.regime),
        txList.map(() => importId),
        txList.map(t => t.fornecedor ?? null),
        txList.map(t => t.dataEmissao ?? null),
        txList.map(t => t.dataVencimento ?? null),
        txList.map(t => JSON.stringify(t.extra ?? {})),
      ]
    );
    return txList.length;
  });
}

/**
 * Deletes all transactions that belong to a specific import batch.
 * Returns the number of deleted rows.
 */
export async function deleteImportTransactions(tenantSchema, importId) {
  return withTenant(tenantSchema, async (client) => {
    const { rowCount } = await client.query(
      `DELETE FROM transactions WHERE import_id = $1`,
      [importId]
    );
    return rowCount;
  });
}

/**
 * Deletes all transactions (used by /api/reset).
 */
export async function clearTransactions(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    await client.query('TRUNCATE transactions RESTART IDENTITY');
  });
}
