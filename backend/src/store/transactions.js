import { withTenant } from '../db/tenantContext.js';

/**
 * Maps a DB row to the shape the frontend expects.
 * Key difference: DB column is "descricao"; API field is "desc".
 */
function normalize(r) {
  return {
    id:     Number(r.id),
    data:   r.data instanceof Date ? r.data.toISOString().split('T')[0] : String(r.data),
    desc:   r.descricao,
    cat:    r.cat,
    grp:    r.grp,
    tipo:   r.tipo,
    nivel:  r.nivel,
    valor:  Number(r.valor),
    mov:    r.mov,
    regime: r.regime,
  };
}

/**
 * Returns { caixa: [], competencia: [] } — same shape as the old store.
 */
export async function getTransactions(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    const { rows } = await client.query(
      `SELECT id, data, descricao, cat, grp, tipo, nivel, valor, mov, regime
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
      `INSERT INTO transactions (data, descricao, cat, grp, tipo, nivel, valor, mov, regime)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tx.data, tx.desc, tx.cat, tx.grp, tx.tipo, tx.nivel, tx.valor, tx.mov, tx.regime]
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
          SET data      = $1,
              descricao = $2,
              cat       = $3,
              grp       = $4,
              tipo      = $5,
              nivel     = $6,
              valor     = $7,
              mov       = $8,
              regime    = $9
        WHERE id = $10
        RETURNING *`,
      [updates.data, updates.desc, updates.cat, updates.grp, updates.tipo,
       nivel, updates.valor, updates.mov, updates.regime, id]
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
 * Returns the count of inserted rows.
 */
export async function bulkInsertTransactions(tenantSchema, txList) {
  if (!txList.length) return 0;
  return withTenant(tenantSchema, async (client) => {
    await client.query('BEGIN');
    try {
      for (const tx of txList) {
        await client.query(
          `INSERT INTO transactions (data, descricao, cat, grp, tipo, nivel, valor, mov, regime)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [tx.data, tx.desc, tx.cat, tx.grp, tx.tipo, tx.nivel, tx.valor, tx.mov, tx.regime]
        );
      }
      await client.query('COMMIT');
      return txList.length;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
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
