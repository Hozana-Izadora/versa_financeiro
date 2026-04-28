import { Router } from 'express';
import { requirePermission } from '../middleware/permission.js';
import * as saldosStore from '../store/saldos.js';

const router = Router();

// GET /api/saldos — flat map for dreBuilder / AppContext
router.get('/', requirePermission('saldos', 'read'), async (req, res, next) => {
  try {
    res.json(await saldosStore.getSaldos(req.tenantSchema));
  } catch (err) { next(err); }
});

// GET /api/saldos/entries — rich list with audit metadata
router.get('/entries', requirePermission('saldos', 'read'), async (req, res, next) => {
  try {
    res.json(await saldosStore.getEntriesWithMeta(req.tenantSchema));
  } catch (err) { next(err); }
});

// GET /api/saldos/log — audit log
router.get('/log', requirePermission('saldos', 'read'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json(await saldosStore.getAuditLog(req.tenantSchema, limit));
  } catch (err) { next(err); }
});

// PUT /api/saldos/entry — upsert single entry
// body: { chave, valor, oldChave? }
router.put('/entry', requirePermission('saldos', 'write'), async (req, res, next) => {
  try {
    const { chave, valor, oldChave } = req.body;
    if (!chave || valor === undefined || valor === null) {
      return res.status(400).json({ error: 'chave e valor são obrigatórios' });
    }
    const changedBy = req.userEmail || req.userId;
    const entries = await saldosStore.upsertEntry(
      req.tenantSchema, oldChave || chave, chave, Number(valor), changedBy
    );
    res.json(entries);
  } catch (err) { next(err); }
});

// DELETE /api/saldos/entry/:chave
router.delete('/entry/:chave', requirePermission('saldos', 'write'), async (req, res, next) => {
  try {
    const chave = decodeURIComponent(req.params.chave);
    const changedBy = req.userEmail || req.userId;
    const entries = await saldosStore.deleteEntry(req.tenantSchema, chave, changedBy);
    res.json(entries);
  } catch (err) { next(err); }
});

// PUT /api/saldos — legacy bulk update
router.put('/', requirePermission('saldos', 'write'), async (req, res, next) => {
  try {
    const { year, base, monthValues } = req.body;
    const changedBy = req.userEmail || req.userId;
    res.json(await saldosStore.upsertSaldos(req.tenantSchema, year, base, monthValues, changedBy));
  } catch (err) { next(err); }
});

export default router;
