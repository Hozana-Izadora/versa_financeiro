import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

const router = Router();

const ACCESS_TOKEN_EXPIRES  = process.env.JWT_EXPIRES_IN         || '15m';
const REFRESH_TOKEN_DAYS    = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function setRefreshCookie(res, token) {
  const expiresMs = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: expiresMs,
    path: '/api/auth',   // cookie is only sent to auth endpoints
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refresh_token', { path: '/api/auth' });
}

// Reads user + client info for building a token/response
async function resolveUserClient(client, userId, clientId) {
  const result = await client.query(
    `SELECT u.id, u.email, u.display_name, c.id AS client_id, c.name AS client_name, c.slug
       FROM admin.users   u
       JOIN admin.client_users cu ON cu.user_id   = u.id
       JOIN admin.clients c       ON c.id          = cu.client_id
      WHERE u.id = $1 AND c.id = $2 AND u.active = true AND c.active = true`,
    [userId, clientId]
  );
  return result.rows[0] || null;
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  const { email, password, clientId } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  let client;
  try {
    client = await pool.connect();
    // 1. Find user
    const userResult = await client.query(
      `SELECT id, email, password_hash, display_name, active
         FROM admin.users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = userResult.rows[0];
    // Always run bcrypt compare even on not-found to prevent timing attacks
    const hashToCheck = user?.password_hash || '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
    const passwordMatch = await bcrypt.compare(password, hashToCheck);

    if (!user || !passwordMatch || !user.active) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // 2. Resolve client (tenant)
    const clientsResult = await client.query(
      `SELECT c.id, c.name, c.slug
         FROM admin.clients c
         JOIN admin.client_users cu ON cu.client_id = c.id
        WHERE cu.user_id = $1 AND c.active = true`,
      [user.id]
    );
    const clients = clientsResult.rows;

    if (!clients.length) {
      return res.status(403).json({ error: 'Usuário não associado a nenhum cliente' });
    }

    let selectedClient;
    if (clientId) {
      selectedClient = clients.find(c => c.id === clientId);
      if (!selectedClient) {
        return res.status(403).json({ error: 'Acesso negado a este cliente' });
      }
    } else if (clients.length === 1) {
      selectedClient = clients[0];
    } else {
      // Multiple clients — frontend must ask which one
      return res.status(200).json({
        requireClientSelection: true,
        clients: clients.map(c => ({ id: c.id, name: c.name })),
      });
    }

    // 3. Issue tokens
    const tokenPayload = {
      sub:         user.id,
      clientId:    selectedClient.id,
      email:       user.email,
      displayName: user.display_name,
    };
    const accessToken  = generateAccessToken(tokenPayload);
    const rawRefresh   = generateRefreshToken();
    const refreshHash  = hashRefreshToken(rawRefresh);
    const refreshExp   = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    // Revoke any existing refresh tokens for this user+client before issuing new one
    await client.query(
      `UPDATE admin.refresh_tokens SET revoked = true
        WHERE user_id = $1 AND client_id = $2 AND revoked = false`,
      [user.id, selectedClient.id]
    );

    await client.query(
      `INSERT INTO admin.refresh_tokens (user_id, client_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, selectedClient.id, refreshHash, refreshExp]
    );

    setRefreshCookie(res, rawRefresh);

    res.json({
      accessToken,
      user: {
        id:          user.id,
        email:       user.email,
        displayName: user.display_name,
        clientId:    selectedClient.id,
        clientName:  selectedClient.name,
      },
    });
  } catch (err) {
    next(err);
  } finally {
    client?.release();
  }
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  const rawToken = req.cookies?.refresh_token;

  if (!rawToken) {
    return res.status(401).json({ error: 'Refresh token ausente' });
  }

  const tokenHash = hashRefreshToken(rawToken);
  let dbClient;
  try {
    dbClient = await pool.connect();
    // Find and validate the stored token
    const result = await dbClient.query(
      `SELECT rt.id, rt.user_id, rt.client_id, rt.expires_at
         FROM admin.refresh_tokens rt
        WHERE rt.token_hash = $1
          AND rt.revoked    = false
          AND rt.expires_at > now()`,
      [tokenHash]
    );

    if (!result.rowCount) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    }

    const { id: tokenId, user_id: userId, client_id: clientId } = result.rows[0];

    // Validate user + client are still active
    const row = await resolveUserClient(dbClient, userId, clientId);
    if (!row) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Usuário ou cliente inativo' });
    }

    // Rotate: revoke old token, issue new one
    const newRaw      = generateRefreshToken();
    const newHash     = hashRefreshToken(newRaw);
    const newExpires  = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await dbClient.query(
      `UPDATE admin.refresh_tokens SET revoked = true WHERE id = $1`,
      [tokenId]
    );
    await dbClient.query(
      `INSERT INTO admin.refresh_tokens (user_id, client_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, clientId, newHash, newExpires]
    );

    const accessToken = generateAccessToken({
      sub:         row.id,
      clientId:    row.client_id,
      email:       row.email,
      displayName: row.display_name,
    });

    setRefreshCookie(res, newRaw);

    res.json({
      accessToken,
      user: {
        id:          row.id,
        email:       row.email,
        displayName: row.display_name,
        clientId:    row.client_id,
        clientName:  row.client_name,
      },
    });
  } catch (err) {
    next(err);
  } finally {
    dbClient?.release();
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  const rawToken = req.cookies?.refresh_token;

  if (rawToken) {
    const tokenHash = hashRefreshToken(rawToken);
    try {
      await pool.query(
        `UPDATE admin.refresh_tokens SET revoked = true WHERE token_hash = $1`,
        [tokenHash]
      );
    } catch (err) {
      next(err);
      return;
    }
  }

  clearRefreshCookie(res);
  res.json({ success: true });
});

export default router;
