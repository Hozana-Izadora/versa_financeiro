import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();
// Auth/superAdmin already enforced by parent adminRouter

// GET /api/admin/roles — list all roles (optionally filter by clientId)
router.get('/', async (req, res, next) => {
  const { clientId } = req.query;
  try {
    const result = clientId
      ? await pool.query(
          `SELECT id, client_id, name, description, permissions, created_at
             FROM admin.roles WHERE client_id = $1 ORDER BY name`,
          [clientId]
        )
      : await pool.query(
          `SELECT id, client_id, name, description, permissions, created_at
             FROM admin.roles ORDER BY name`
        );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/admin/roles — create a role (clientId optional)
router.post('/', async (req, res, next) => {
  const { name, description, permissions, clientId } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name é obrigatório' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO admin.roles (client_id, name, description, permissions)
       VALUES ($1, $2, $3, $4)
       RETURNING id, client_id, name, description, permissions, created_at`,
      [clientId || null, name.trim(), description?.trim() || null, permissions ?? {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma função com este nome.' });
    next(err);
  }
});

// PUT /api/admin/roles/:id
router.put('/:id', async (req, res, next) => {
  const { name, description, permissions } = req.body;
  const sets = []; const params = []; let i = 1;
  if (name        !== undefined) { sets.push(`name = $${i++}`);        params.push(name.trim()); }
  if (description !== undefined) { sets.push(`description = $${i++}`); params.push(description?.trim() || null); }
  if (permissions !== undefined) { sets.push(`permissions = $${i++}`); params.push(permissions); }
  if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  params.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE admin.roles SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, client_id, name, description, permissions, created_at`,
      params
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Função não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma função com este nome.' });
    next(err);
  }
});

// DELETE /api/admin/roles/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM admin.roles WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Função não encontrada' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
