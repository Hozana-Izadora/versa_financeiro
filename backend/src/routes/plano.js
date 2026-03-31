import { Router } from 'express';
import { requirePermission } from '../middleware/permission.js';
import * as planoStore from '../store/plano.js';

const router = Router();

// GET /api/plano
router.get('/', requirePermission('plano', 'read'), async (req, res, next) => {
  try {
    res.json(await planoStore.getPlano(req.tenantSchema));
  } catch (err) { next(err); }
});

// PUT /api/plano/categoria/:cat — must be declared before /:tipo
router.put('/categoria/:cat', requirePermission('plano', 'write'), async (req, res, next) => {
  try {
    const oldCat = decodeURIComponent(req.params.cat);
    const { newName, cor } = req.body;
    res.json(await planoStore.updateCategoria(req.tenantSchema, oldCat, newName, cor));
  } catch (err) { next(err); }
});

// DELETE /api/plano/categoria/:cat
router.delete('/categoria/:cat', requirePermission('plano', 'write'), async (req, res, next) => {
  try {
    const cat = decodeURIComponent(req.params.cat);
    res.json(await planoStore.deleteCategoria(req.tenantSchema, cat));
  } catch (err) { next(err); }
});

// POST /api/plano
router.post('/', requirePermission('plano', 'write'), async (req, res, next) => {
  try {
    const plano = await planoStore.createPlanoItem(req.tenantSchema, req.body);
    res.status(201).json(plano);
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
});

// PUT /api/plano/:tipo
router.put('/:tipo', requirePermission('plano', 'write'), async (req, res, next) => {
  try {
    const oldTipo = decodeURIComponent(req.params.tipo);
    const plano = await planoStore.updatePlanoItem(req.tenantSchema, oldTipo, req.body);
    res.json(plano);
  } catch (err) { next(err); }
});

// DELETE /api/plano/:tipo
router.delete('/:tipo', requirePermission('plano', 'write'), async (req, res, next) => {
  try {
    const tipo = decodeURIComponent(req.params.tipo);
    const plano = await planoStore.deletePlanoItem(req.tenantSchema, tipo);
    res.json(plano);
  } catch (err) { next(err); }
});

export default router;
