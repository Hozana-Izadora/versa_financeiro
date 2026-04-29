import { withTenant } from '../db/tenantContext.js';

export async function getOrcamento(schema, ano) {
  return withTenant(schema, async (client) => {
    const { rows } = await client.query(
      `SELECT id, ano, mes, tipo, referencia, valor
       FROM orcamento
       WHERE ano = $1
       ORDER BY tipo, referencia, mes NULLS FIRST`,
      [ano]
    );
    return rows.map(r => ({ ...r, valor: Number(r.valor) }));
  });
}

export async function upsertOrcamento(schema, entries) {
  if (!entries.length) return [];
  return withTenant(schema, async (client) => {
    const results = [];
    for (const e of entries) {
      const { rows } = await client.query(
        `INSERT INTO orcamento(ano, mes, tipo, referencia, valor)
         VALUES($1, $2, $3, $4, $5)
         ON CONFLICT (ano, COALESCE(mes, -1), tipo, referencia)
         DO UPDATE SET valor = EXCLUDED.valor, created_at = now()
         RETURNING id, ano, mes, tipo, referencia, valor`,
        [e.ano, e.mes ?? null, e.tipo, e.referencia ?? '', Number(e.valor)]
      );
      results.push({ ...rows[0], valor: Number(rows[0].valor) });
    }
    return results;
  });
}

export async function deleteOrcamentoEntry(schema, id) {
  return withTenant(schema, async (client) => {
    await client.query('DELETE FROM orcamento WHERE id = $1', [id]);
  });
}
