import { withTenant } from '../db/tenantContext.js';

/**
 * Returns flat saldos map — same shape consumed by dreBuilder and AppContext:
 * { "2026-abertura": 10000, "2026-01": 500, ... }
 */
export async function getSaldos(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    const { rows } = await client.query(`SELECT chave, valor FROM saldos_iniciais`);
    const result = {};
    for (const r of rows) {
      result[r.chave] = Number(r.valor) || 0;
    }
    return result;
  });
}

/**
 * Returns rich list of entries including audit metadata.
 * Used by the Saldos management UI.
 */
export async function getEntriesWithMeta(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    const { rows } = await client.query(
      `SELECT chave, valor, updated_by, updated_at
       FROM saldos_iniciais
       ORDER BY chave`
    );
    return rows.map(r => ({
      chave:      r.chave,
      valor:      Number(r.valor) || 0,
      updatedBy:  r.updated_by || null,
      updatedAt:  r.updated_at || null,
    }));
  });
}

/**
 * Upserts a single saldo entry and writes an audit log row.
 * If oldChave differs from chave (date change), deletes oldChave first.
 */
export async function upsertEntry(tenantSchema, oldChave, chave, valor, changedBy) {
  return withTenant(tenantSchema, async (client) => {
    await client.query('BEGIN');
    try {
      const rename = oldChave && oldChave !== chave;

      if (rename) {
        // Read old value for audit
        const { rows: existing } = await client.query(
          'SELECT valor FROM saldos_iniciais WHERE chave = $1', [oldChave]
        );
        const oldValor = existing[0]?.valor ?? null;

        await client.query('DELETE FROM saldos_iniciais WHERE chave = $1', [oldChave]);
        await client.query(
          `INSERT INTO saldo_audit_log (chave, old_valor, new_valor, operacao, changed_by)
           VALUES ($1, $2, $3, 'DELETE', $4)`,
          [oldChave, oldValor, null, changedBy]
        );
      }

      // Read current value at new chave for audit
      const { rows: cur } = await client.query(
        'SELECT valor FROM saldos_iniciais WHERE chave = $1', [chave]
      );
      const oldValor  = cur[0]?.valor ?? null;
      const operacao  = oldValor === null ? 'INSERT' : 'UPDATE';

      await client.query(
        `INSERT INTO saldos_iniciais (chave, valor, updated_by, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (chave) DO UPDATE
           SET valor = EXCLUDED.valor, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [chave, String(valor), changedBy]
      );

      await client.query(
        `INSERT INTO saldo_audit_log (chave, old_valor, new_valor, operacao, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [chave, oldValor, String(valor), operacao, changedBy]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    return getEntriesWithMeta(tenantSchema);
  });
}

/**
 * Deletes a single saldo entry and logs the removal.
 */
export async function deleteEntry(tenantSchema, chave, changedBy) {
  return withTenant(tenantSchema, async (client) => {
    const { rows: existing } = await client.query(
      'SELECT valor FROM saldos_iniciais WHERE chave = $1', [chave]
    );
    if (!existing[0]) return getEntriesWithMeta(tenantSchema);

    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM saldos_iniciais WHERE chave = $1', [chave]);
      await client.query(
        `INSERT INTO saldo_audit_log (chave, old_valor, new_valor, operacao, changed_by)
         VALUES ($1, $2, null, 'DELETE', $3)`,
        [chave, existing[0].valor, changedBy]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    return getEntriesWithMeta(tenantSchema);
  });
}

/**
 * Returns audit log ordered by most recent.
 */
export async function getAuditLog(tenantSchema, limit = 100) {
  return withTenant(tenantSchema, async (client) => {
    const { rows } = await client.query(
      `SELECT id, chave, old_valor, new_valor, operacao, changed_by, changed_at
       FROM saldo_audit_log
       ORDER BY changed_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  });
}

/**
 * Bulk upsert (used by legacy endpoint). Kept for backwards compatibility.
 */
export async function upsertSaldos(tenantSchema, year, base, monthValues, changedBy = 'system') {
  return withTenant(tenantSchema, async (client) => {
    await client.query('BEGIN');
    try {
      if (base !== undefined) {
        const chave = `${year}-abertura`;
        const { rows: cur } = await client.query(
          'SELECT valor FROM saldos_iniciais WHERE chave = $1', [chave]
        );
        const oldValor = cur[0]?.valor ?? null;
        const operacao = oldValor === null ? 'INSERT' : 'UPDATE';

        await client.query(
          `INSERT INTO saldos_iniciais (chave, valor, updated_by, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (chave) DO UPDATE
             SET valor = EXCLUDED.valor, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [chave, String(base), changedBy]
        );
        await client.query(
          `INSERT INTO saldo_audit_log (chave, old_valor, new_valor, operacao, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [chave, oldValor, String(base), operacao, changedBy]
        );
      }

      if (monthValues && typeof monthValues === 'object') {
        for (const [chave, valor] of Object.entries(monthValues)) {
          if (!valor && valor !== 0) continue;
          const { rows: cur } = await client.query(
            'SELECT valor FROM saldos_iniciais WHERE chave = $1', [chave]
          );
          const oldValor = cur[0]?.valor ?? null;
          const operacao = oldValor === null ? 'INSERT' : 'UPDATE';

          await client.query(
            `INSERT INTO saldos_iniciais (chave, valor, updated_by, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (chave) DO UPDATE
               SET valor = EXCLUDED.valor, updated_by = EXCLUDED.updated_by, updated_at = now()`,
            [chave, String(valor), changedBy]
          );
          await client.query(
            `INSERT INTO saldo_audit_log (chave, old_valor, new_valor, operacao, changed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [chave, oldValor, String(valor), operacao, changedBy]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    return getSaldos(tenantSchema);
  });
}

/**
 * Clears all saldo entries. Used by /api/reset.
 */
export async function clearSaldos(tenantSchema) {
  return withTenant(tenantSchema, async (client) => {
    await client.query('TRUNCATE saldos_iniciais, saldo_audit_log');
  });
}
