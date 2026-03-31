import { Router } from 'express';
import { requirePermission } from '../middleware/permission.js';
import * as txStore from '../store/transactions.js';

const router = Router();

// GET /api/transactions
router.get('/', requirePermission('lancamentos', 'read'), async (req, res, next) => {
  try {
    res.json(await txStore.getTransactions(req.tenantSchema));
  } catch (err) { next(err); }
});

// POST /api/transactions
router.post('/', requirePermission('lancamentos', 'write'), async (req, res, next) => {
  try {
    const created = await txStore.createTransaction(req.tenantSchema, req.body);
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// PUT /api/transactions/:id
router.put('/:id', requirePermission('lancamentos', 'write'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await txStore.updateTransaction(req.tenantSchema, id, req.body);
    if (!updated) return res.status(404).json({ error: 'Transaction not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/transactions/:id
router.delete('/:id', requirePermission('lancamentos', 'write'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await txStore.deleteTransaction(req.tenantSchema, id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
