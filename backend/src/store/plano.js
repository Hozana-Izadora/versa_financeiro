import { withTenant } from '../db/tenantContext.js';

function normalizeItem(r) {
  return { tipo: r.tipo, grp: r.grp, cat: r.cat, nivel: r.nivel };
}

/**
 * Returns { plano: [], planoCores: {} } — same shape as old store.
 */
export async function getPlano(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    const [planoResult, coresResult] = await Promise.all([
      client.query(`SELECT tipo, grp, cat, nivel FROM plano ORDER BY cat, grp, tipo`),
      client.query(`SELECT cat, cor FROM plano_cores`),
    ]);
    const planoCores = {};
    coresResult.rows.forEach(r => { planoCores[r.cat] = r.cor; });
    return {
      plano:      planoResult.rows.map(normalizeItem),
      planoCores,
    };
  });
}

/**
 * Creates a new plano item. Returns the full updated plano array.
 * Throws if the tipo already exists (409).
 */
export async function createPlanoItem(tenantSchema, item) {
  return withTenant(tenantSchema, async (client) => {
    const exists = await client.query(
      `SELECT 1 FROM plano WHERE tipo = $1`,
      [item.tipo]
    );
    if (exists.rowCount > 0) {
      const err = new Error('Tipo já existe');
      err.status = 409;
      throw err;
    }
    await client.query(
      `INSERT INTO plano (tipo, grp, cat, nivel) VALUES ($1, $2, $3, $4)`,
      [item.tipo, item.grp, item.cat, item.nivel]
    );
    const { rows } = await client.query(
      `SELECT tipo, grp, cat, nivel FROM plano ORDER BY cat, grp, tipo`
    );
    return rows.map(normalizeItem);
  });
}

/**
 * Updates a plano item and cascades the rename to all transactions.
 * Runs inside a single DB transaction for atomicity.
 * Returns the full updated plano array.
 */
export async function updatePlanoItem(tenantSchema, oldTipo, newItem) {
  return withTenant(tenantSchema, async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE plano
            SET tipo  = $1,
                grp   = $2,
                cat   = $3,
                nivel = $4
          WHERE tipo = $5`,
        [newItem.tipo, newItem.grp, newItem.cat, newItem.nivel, oldTipo]
      );
      // Cascade to all transactions using this tipo
      await client.query(
        `UPDATE transactions
            SET tipo  = $1,
                grp   = $2,
                cat   = $3,
                nivel = $4
          WHERE tipo = $5`,
        [newItem.tipo, newItem.grp, newItem.cat, newItem.nivel, oldTipo]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    const { rows } = await client.query(
      `SELECT tipo, grp, cat, nivel FROM plano ORDER BY cat, grp, tipo`
    );
    return rows.map(normalizeItem);
  });
}

/**
 * Deletes a plano item by tipo.
 * Returns the full updated plano array.
 */
export async function deletePlanoItem(tenantSchema, tipo) {
  return withTenant(tenantSchema, async (client) => {
    await client.query(`DELETE FROM plano WHERE tipo = $1`, [tipo]);
    const { rows } = await client.query(
      `SELECT tipo, grp, cat, nivel FROM plano ORDER BY cat, grp, tipo`
    );
    return rows.map(normalizeItem);
  });
}

/**
 * Renames a category and its color, cascading to plano items and transactions.
 * Runs inside a single DB transaction.
 * Returns { plano, planoCores }.
 */
export async function updateCategoria(tenantSchema, oldCat, newName, cor) {
  return withTenant(tenantSchema, async (client) => {
    await client.query('BEGIN');
    try {
      // Update plano items
      await client.query(
        `UPDATE plano SET cat = $1 WHERE cat = $2`,
        [newName, oldCat]
      );
      // Update transactions
      await client.query(
        `UPDATE transactions SET cat = $1 WHERE cat = $2`,
        [newName, oldCat]
      );
      // Update plano_cores (upsert new name, remove old)
      await client.query(`DELETE FROM plano_cores WHERE cat = $1`, [oldCat]);
      await client.query(
        `INSERT INTO plano_cores (cat, cor) VALUES ($1, $2)
         ON CONFLICT (cat) DO UPDATE SET cor = EXCLUDED.cor`,
        [newName, cor]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    return _readPlano(client);
  });
}

/**
 * Deletes a category and its color entry.
 * Does NOT delete associated transactions — orphaned transactions keep their cat value.
 * Returns { plano, planoCores }.
 */
export async function deleteCategoria(tenantSchema, cat) {
  return withTenant(tenantSchema, async (client) => {
    await client.query(`DELETE FROM plano      WHERE cat = $1`, [cat]);
    await client.query(`DELETE FROM plano_cores WHERE cat = $1`, [cat]);
    return _readPlano(client);
  });
}

/**
 * Resets plano and plano_cores to the supplied default data.
 * Used by /api/reset.
 */
export async function resetPlano(tenantSchema, defaultPlano, defaultCores) {
  return withTenant(tenantSchema, async (client) => {
    await client.query('BEGIN');
    try {
      await client.query('TRUNCATE plano RESTART IDENTITY');
      await client.query('TRUNCATE plano_cores');
      for (const item of defaultPlano) {
        await client.query(
          `INSERT INTO plano (tipo, grp, cat, nivel) VALUES ($1, $2, $3, $4)`,
          [item.tipo, item.grp, item.cat, item.nivel]
        );
      }
      for (const [cat, cor] of Object.entries(defaultCores)) {
        await client.query(
          `INSERT INTO plano_cores (cat, cor) VALUES ($1, $2)`,
          [cat, cor]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

async function _readPlano(client) {
  const [planoResult, coresResult] = await Promise.all([
    client.query(`SELECT tipo, grp, cat, nivel FROM plano ORDER BY cat, grp, tipo`),
    client.query(`SELECT cat, cor FROM plano_cores`),
  ]);
  const planoCores = {};
  coresResult.rows.forEach(r => { planoCores[r.cat] = r.cor; });
  return { plano: planoResult.rows.map(normalizeItem), planoCores };
}
