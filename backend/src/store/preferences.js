import { pool } from '../db/pool.js';

/**
 * Per-user UI preferences (e.g. visible columns in Lançamentos), scoped to
 * the user+client pair via admin.client_users. Unlike the other stores this
 * reads the shared `admin` schema directly — it is not tenant data.
 */

export async function getUserPreferences(userId, clientId) {
  const { rows } = await pool.query(
    `SELECT preferences FROM admin.client_users WHERE user_id = $1 AND client_id = $2`,
    [userId, clientId]
  );
  return rows[0]?.preferences ?? {};
}

export async function setUserPreference(userId, clientId, key, value) {
  const { rows } = await pool.query(
    `UPDATE admin.client_users
        SET preferences = jsonb_set(preferences, $3::text[], $4::jsonb, true)
      WHERE user_id = $1 AND client_id = $2
      RETURNING preferences`,
    [userId, clientId, `{${key}}`, JSON.stringify(value)]
  );
  return rows[0]?.preferences ?? null;
}
