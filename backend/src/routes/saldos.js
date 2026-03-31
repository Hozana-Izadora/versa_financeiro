import { Router } from 'express';
import { requirePermission } from '../middleware/permission.js';
import * as saldosStore from '../store/saldos.js';

const router = Router();

// GET /api/saldos
router.get('/', requirePermission('saldos', 'read'), async (req, res, next) => {
  try {
    res.json(await saldosStore.getSaldos(req.tenantSchema));
  } catch (err) { next(err); }
});

// PUT /api/saldos
router.put('/', requirePermission('saldos', 'write'), async (req, res, next) => {
  try {
    const { year, base, monthValues } = req.body;
    res.json(await saldosStore.upsertSaldos(req.tenantSchema, year, base, monthValues));
  } catch (err) { next(err); }
});

export default router;
