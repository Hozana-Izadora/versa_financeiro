import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

/**
 * Verifies the Bearer token and attaches req.userId, req.tenantId,
 * req.tenantSchema, and req.isSuperAdmin to the request.
 *
 * Two valid token shapes:
 *  1. Client-scoped   — payload has clientId; resolves tenant schema.
 *  2. Admin-only      — payload has isSuperAdmin=true, no clientId;
 *                       sets tenantSchema=null (admin routes only).
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticação necessária' });
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token expirado'
      : 'Token inválido';
    return res.status(401).json({ error: message });
  }

  // Admin-only session (superadmin without a client context)
  if (payload.isSuperAdmin && !payload.clientId) {
    req.userId       = payload.sub;
    req.userEmail    = payload.email;
    req.displayName  = payload.displayName;
    req.isSuperAdmin = true;
    req.tenantId     = null;
    req.tenantSchema = null;
    return next();
  }

  // Client-scoped session (regular user or superadmin viewing a client)
  try {
    const result = await pool.query(
      `SELECT slug FROM admin.clients WHERE id = $1 AND active = true`,
      [payload.clientId]
    );

    if (!result.rowCount) {
      return res.status(401).json({ error: 'Cliente inativo ou não encontrado' });
    }

    req.userId       = payload.sub;
    req.userEmail    = payload.email;
    req.displayName  = payload.displayName;
    req.tenantId     = payload.clientId;
    req.tenantSchema = `tenant_${result.rows[0].slug}`;
    req.isSuperAdmin = payload.isSuperAdmin === true;
    next();
  } catch (err) {
    next(err);
  }
}
