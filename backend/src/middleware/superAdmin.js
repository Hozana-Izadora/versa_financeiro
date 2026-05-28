export function requireSuperAdmin(req, res, next) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}
