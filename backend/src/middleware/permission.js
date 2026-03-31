import { pool } from '../db/pool.js';

/**
 * Returns an Express middleware that enforces module-level permissions.
 *
 * Logic:
 *  - If the user has no roles assigned for this client, they are treated as
 *    an owner (full access). This covers the first user created via createUser.js.
 *  - If the user has roles, their permissions are checked against role_permissions.
 *    "write" access implies "read". Missing entry means no access to that module.
 *
 * @param {'lancamentos'|'plano'|'saldos'|'importar'} module
 * @param {'read'|'write'} required
 */
export function requirePermission(module, required = 'read') {
  return async (req, res, next) => {
    // authMiddleware always runs before this and sets req.userId
    if (!req.userId) return next();

    try {
      // Check if the user has any roles for this client
      const roleCount = await pool.query(
        `SELECT COUNT(*) AS n
           FROM admin.user_roles ur
           JOIN admin.roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1 AND r.client_id = $2`,
        [req.userId, req.tenantId]
      );

      // No roles → owner-level access, allow everything
      if (parseInt(roleCount.rows[0].n, 10) === 0) return next();

      // Has roles → check specific module permission
      const result = await pool.query(
        `SELECT rp.access
           FROM admin.role_permissions rp
           JOIN admin.user_roles ur ON ur.role_id = rp.role_id
           JOIN admin.roles r       ON r.id        = rp.role_id
          WHERE ur.user_id  = $1
            AND r.client_id = $2
            AND rp.module   = $3::admin.module_name`,
        [req.userId, req.tenantId, module]
      );

      const levels   = result.rows.map(r => r.access);
      const hasWrite = levels.includes('write');
      const hasRead  = hasWrite || levels.includes('read');
      const granted  = required === 'write' ? hasWrite : hasRead;

      if (!granted) {
        return res.status(403).json({ error: `Acesso negado: ${required} em ${module}` });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
