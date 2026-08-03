import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { requireSuperAdmin } from '../middleware/superAdmin.js';
import rolesRouter from './roles.js';

const router = Router();

// All admin routes require superadmin
router.use(requireSuperAdmin);

// Roles sub-router (inherits requireSuperAdmin from above)
router.use('/roles', rolesRouter);

// ── Clients (tenants) ─────────────────────────────────────────────────────────

// GET /api/admin/clients
router.get('/clients', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, slug, name, logo, active, created_at
         FROM admin.clients
        ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Data URI validation for uploaded logos — kept small since it's stored inline in Postgres.
const LOGO_DATA_URI_RE = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,/;
const LOGO_MAX_LENGTH  = 700_000; // ~500KB decoded

function validateLogo(logo) {
  if (logo === null) return null; // explicit clear
  if (!LOGO_DATA_URI_RE.test(logo)) {
    throw Object.assign(new Error('Logo inválida. Envie uma imagem PNG, JPEG, WEBP ou SVG.'), { status: 400 });
  }
  if (logo.length > LOGO_MAX_LENGTH) {
    throw Object.assign(new Error('Logo muito grande. Envie uma imagem de até ~500KB.'), { status: 400 });
  }
  return logo;
}

// POST /api/admin/clients — provisions a new tenant schema
router.post('/clients', async (req, res, next) => {
  const { name, slug } = req.body;
  if (!name?.trim() || !slug?.trim()) {
    return res.status(400).json({ error: 'name e slug são obrigatórios' });
  }
  const slugNorm = slug.toLowerCase().trim();
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(slugNorm)) {
    return res.status(400).json({
      error: 'Slug inválido. Use apenas letras minúsculas, números e underscores (ex: minha_empresa).',
    });
  }
  try {
    const result = await pool.query(
      `SELECT admin.provision_tenant($1, $2) AS id`,
      [slugNorm, name.trim()]
    );
    const clientId = result.rows[0].id;
    const client = await pool.query(
      `SELECT id, slug, name, logo, active, created_at FROM admin.clients WHERE id = $1`,
      [clientId]
    );
    res.status(201).json(client.rows[0]);
  } catch (err) {
    if (err.message?.includes('already exists')) {
      return res.status(409).json({ error: `Empresa com slug "${slugNorm}" já existe.` });
    }
    next(err);
  }
});

// PUT /api/admin/clients/:id — update name, active flag, or logo
router.put('/clients/:id', async (req, res, next) => {
  const { name, active, logo } = req.body;
  const sets = [];
  const params = [];
  let i = 1;
  if (name !== undefined) { sets.push(`name = $${i++}`); params.push(name.trim()); }
  if (active !== undefined) { sets.push(`active = $${i++}`); params.push(Boolean(active)); }
  if (logo !== undefined) {
    let validLogo;
    try { validLogo = validateLogo(logo); }
    catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
    sets.push(`logo = $${i++}`); params.push(validLogo);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  params.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE admin.clients SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, slug, name, logo, active, created_at`,
      params
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── Users ─────────────────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.active, u.is_superadmin, u.created_at,
              COALESCE(
                json_agg(
                  json_build_object('id', c.id, 'name', c.name, 'slug', c.slug,
                                    'role_id', cu.role_id, 'role_name', r.name)
                  ORDER BY c.name
                ) FILTER (WHERE c.id IS NOT NULL),
                '[]'
              ) AS clients
         FROM admin.users u
         LEFT JOIN admin.client_users cu ON cu.user_id = u.id
         LEFT JOIN admin.clients       c  ON c.id = cu.client_id
         LEFT JOIN admin.roles         r  ON r.id  = cu.role_id
        GROUP BY u.id
        ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/admin/users — create user + optional client association
router.post('/users', async (req, res, next) => {
  const { email, password, name, clientId, isSuperAdmin } = req.body;
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'email e password são obrigatórios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
  }
  const emailNorm = email.toLowerCase().trim();
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const existing = await dbClient.query(
      `SELECT id FROM admin.users WHERE email = $1`, [emailNorm]
    );
    if (existing.rowCount > 0) {
      await dbClient.query('ROLLBACK');
      return res.status(409).json({ error: 'Usuário com este e-mail já existe.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const userResult = await dbClient.query(
      `INSERT INTO admin.users (email, password_hash, display_name, is_superadmin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, active, is_superadmin, created_at`,
      [emailNorm, hash, name?.trim() || null, Boolean(isSuperAdmin)]
    );
    const user = userResult.rows[0];

    if (clientId) {
      const check = await dbClient.query(
        `SELECT id FROM admin.clients WHERE id = $1 AND active = true`, [clientId]
      );
      if (!check.rowCount) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ error: 'Empresa não encontrada.' });
      }
      await dbClient.query(
        `INSERT INTO admin.client_users (client_id, user_id) VALUES ($1, $2)`,
        [clientId, user.id]
      );
    }

    await dbClient.query('COMMIT');
    res.status(201).json({ ...user, clients: [] });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    next(err);
  } finally {
    dbClient.release();
  }
});

// PUT /api/admin/users/:id — update name, active, superadmin flag, or password
router.put('/users/:id', async (req, res, next) => {
  const { name, active, isSuperAdmin, password } = req.body;
  const sets = [];
  const params = [];
  let i = 1;
  if (name !== undefined)        { sets.push(`display_name = $${i++}`);   params.push(name.trim()); }
  if (active !== undefined)      { sets.push(`active = $${i++}`);          params.push(Boolean(active)); }
  if (isSuperAdmin !== undefined){ sets.push(`is_superadmin = $${i++}`);  params.push(Boolean(isSuperAdmin)); }
  if (password !== undefined) {
    if (password.length < 8) return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres.' });
    const hash = await bcrypt.hash(password, 12);
    sets.push(`password_hash = $${i++}`);
    params.push(hash);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  params.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE admin.users SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, email, display_name, active, is_superadmin, created_at`,
      params
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/admin/users/:id/clients — add user to a client
router.post('/users/:id/clients', async (req, res, next) => {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: 'clientId é obrigatório' });
  try {
    await pool.query(
      `INSERT INTO admin.client_users (client_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [clientId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/admin/users/:id/clients/:clientId — remove user from a client
router.delete('/users/:id/clients/:clientId', async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM admin.client_users
        WHERE user_id = $1 AND client_id = $2`,
      [req.params.id, req.params.clientId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PUT /api/admin/users/:id/clients/:clientId/role — assign/clear role for a user-client pair
router.put('/users/:id/clients/:clientId/role', async (req, res, next) => {
  const { roleId } = req.body; // null/undefined = clear role
  try {
    await pool.query(
      `UPDATE admin.client_users SET role_id = $1
        WHERE user_id = $2 AND client_id = $3`,
      [roleId || null, req.params.id, req.params.clientId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
