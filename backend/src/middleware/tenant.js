import { pool } from '../db/pool.js';

/**
 * Reads the X-Tenant-ID header (a client UUID), validates it exists
 * in admin.clients, and attaches req.tenantSchema and req.tenantId.
 *
 * Phase 1 (no JWT): any caller with a valid UUID can access the tenant.
 * Phase 2 (with JWT): the JWT payload will carry client_id; this middleware
 *   can then cross-check the claim against the header or drop the header
 *   entirely and derive tenantSchema from the token.
 */
export async function tenantMiddleware(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing X-Tenant-ID header' });
  }

  // Basic UUID shape check before hitting the DB
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    return res.status(400).json({ error: 'Invalid X-Tenant-ID format' });
  }

  try {
    const result = await pool.query(
      `SELECT slug FROM admin.clients WHERE id = $1 AND active = true`,
      [tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tenant not found or inactive' });
    }

    req.tenantSchema = `tenant_${result.rows[0].slug}`;
    req.tenantId = tenantId;
    next();
  } catch (err) {
    next(err);
  }
}
