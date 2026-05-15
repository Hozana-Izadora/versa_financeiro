import { withTenant } from '../db/tenantContext.js';

/**
 * Returns import history entries — same shape the frontend expects:
 * [{ name, rows, base, date }, ...]
 * The "date" field is formatted as pt-BR locale string to match old behavior.
 */
export async function getImportHistory(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    const { rows } = await client.query(
      `SELECT id, name, rows, base, imported_at
         FROM import_history
        ORDER BY imported_at DESC`
    );
    return rows.map(r => ({
      id:   Number(r.id),
      name: r.name,
      rows: r.rows,
      base: r.base,
      date: new Date(r.imported_at).toLocaleDateString('pt-BR'),
    }));
  });
}

/**
 * Appends a new import history entry.
 * Returns { importId, history } — importId is used to tag inserted transactions.
 */
export async function addImportEntry(tenantSchema, entry) {
  return withTenant(tenantSchema, async (client) => {
    const insert = await client.query(
      `INSERT INTO import_history (name, rows, base) VALUES ($1, $2, $3) RETURNING id`,
      [entry.name, entry.rows, entry.base]
    );
    const importId = Number(insert.rows[0].id);
    const { rows } = await client.query(
      `SELECT id, name, rows, base, imported_at
         FROM import_history
        ORDER BY imported_at DESC`
    );
    return {
      importId,
      history: rows.map(r => ({
        id:   Number(r.id),
        name: r.name,
        rows: r.rows,
        base: r.base,
        date: new Date(r.imported_at).toLocaleDateString('pt-BR'),
      })),
    };
  });
}

/**
 * Deletes a single import history entry and all its linked transactions.
 * The transactions deletion happens via deleteImportTransactions in the route layer
 * to keep stores decoupled. Returns the deleted entry metadata.
 */
export async function deleteImportEntry(tenantSchema, importId) {
  return withTenant(tenantSchema, async (client) => {
    const { rows } = await client.query(
      `DELETE FROM import_history WHERE id = $1 RETURNING id, name, rows, base`,
      [importId]
    );
    return rows[0] ?? null;
  });
}

/**
 * Clears all import history. Used by DELETE /api/import/history and /api/reset.
 */
export async function clearImportHistory(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    await client.query('TRUNCATE import_history RESTART IDENTITY CASCADE');
  });
}
