import { Router } from 'express';
import { requirePermission } from '../middleware/permission.js';
import * as prefsStore from '../store/preferences.js';

const router = Router();

// GET /api/preferences
router.get('/', requirePermission('lancamentos', 'read'), async (req, res, next) => {
  try {
    res.json(await prefsStore.getUserPreferences(req.userId, req.tenantId));
  } catch (err) { next(err); }
});

// PUT /api/preferences/:key — body: { value }
router.put('/:key', requirePermission('lancamentos', 'write'), async (req, res, next) => {
  try {
    const preferences = await prefsStore.setUserPreference(req.userId, req.tenantId, req.params.key, req.body.value);
    res.json(preferences);
  } catch (err) { next(err); }
});

export default router;
