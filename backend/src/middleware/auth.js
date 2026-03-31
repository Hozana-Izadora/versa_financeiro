import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

/**
 * Verifies the Bearer token, resolves the tenant schema, and attaches
 * req.userId, req.tenantId, and req.tenantSchema to the request.
 *
 * Returns 401 if the token is missing, invalid, or expired.
 * Returns 401 if the client encoded in the token is inactive or deleted.
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

  // Validate the client encoded in the token is still active.
  // This also resolves the schema name, so we don't need a separate tenant lookup.
  try {
    const result = await pool.query(
      `SELECT slug FROM admin.clients WHERE id = $1 AND active = true`,
      [payload.clientId]
    );

    if (!result.rowCount) {
      return res.status(401).json({ error: 'Cliente inativo ou não encontrado' });
    }

    req.userId       = payload.sub;
    req.tenantId     = payload.clientId;
    req.tenantSchema = `tenant_${result.rows[0].slug}`;
    next();
  } catch (err) {
    next(err);
  }
}
