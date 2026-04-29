import { Router } from 'express';
import * as store from '../store/orcamento.js';

const router = Router();

// GET /api/orcamento?ano=YYYY
router.get('/', async (req, res, next) => {
  try {
    const ano = parseInt(req.query.ano) || new Date().getFullYear();
    const entries = await store.getOrcamento(req.tenantSchema, ano);
    res.json(entries);
  } catch (err) { next(err); }
});

// PUT /api/orcamento  — bulk upsert
// Body: [{ ano, mes, tipo, referencia, valor }]
router.put('/', async (req, res, next) => {
  try {
    const entries = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Body must be a non-empty array of entries.' });
    }
    for (const e of entries) {
      if (e.ano == null || e.tipo == null || e.valor == null) {
        return res.status(400).json({ error: 'Each entry requires ano, tipo and valor.' });
      }
    }
    const saved = await store.upsertOrcamento(req.tenantSchema, entries);
    res.json(saved);
  } catch (err) { next(err); }
});

// DELETE /api/orcamento/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await store.deleteOrcamentoEntry(req.tenantSchema, req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
