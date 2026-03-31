import { withTenant } from '../db/tenantContext.js';

/**
 * Returns the saldos object — same shape as old store:
 * { "2026-base": "Caixa", "2026-01": 5000, ... }
 */
export async function getSaldos(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    const { rows } = await client.query(
      `SELECT chave, valor FROM saldos_iniciais`
    );
    const result = {};
    for (const r of rows) {
      // "YYYY-base" rows store the regime string; "YYYY-MM" rows store a numeric value
      result[r.chave] = r.chave.endsWith('-base') ? r.valor : Number(r.valor);
    }
    return result;
  });
}

/**
 * Upserts saldo entries for a given year.
 * - base: "Caixa" | "Competência" — stored under key "YYYY-base"
 * - monthValues: { "YYYY-MM": number, ... }
 * Returns the full saldos object after update.
 */
export async function upsertSaldos(tenantSchema, year, base, monthValues) {
  return withTenant(tenantSchema, async (client) => {
    await client.query('BEGIN');
    try {
      if (base !== undefined) {
        await client.query(
          `INSERT INTO saldos_iniciais (chave, valor) VALUES ($1, $2)
           ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
          [`${year}-base`, String(base)]
        );
      }
      if (monthValues && typeof monthValues === 'object') {
        for (const [chave, valor] of Object.entries(monthValues)) {
          await client.query(
            `INSERT INTO saldos_iniciais (chave, valor) VALUES ($1, $2)
             ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
            [chave, String(valor)]
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const { rows } = await client.query(`SELECT chave, valor FROM saldos_iniciais`);
    const result = {};
    for (const r of rows) {
      result[r.chave] = r.chave.endsWith('-base') ? r.valor : Number(r.valor);
    }
    return result;
  });
}

/**
 * Clears all saldo entries. Used by /api/reset.
 */
export async function clearSaldos(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    await client.query('TRUNCATE saldos_iniciais');
  });
}
