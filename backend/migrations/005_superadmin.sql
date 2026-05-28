-- ============================================================
-- Migration 005: Superadmin support
-- Adds is_superadmin flag to users, allows admin-only sessions
-- (refresh_tokens without a client), and expands grants so the
-- app can manage users/clients through the admin API.
-- ============================================================

-- Flag superadmin users
ALTER TABLE admin.users
  ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT false;

-- Allow refresh tokens without a client (superadmin admin-only sessions)
ALTER TABLE admin.refresh_tokens
  ALTER COLUMN client_id DROP NOT NULL;

-- The app needs write access to admin tables for the admin panel
GRANT INSERT, UPDATE, DELETE ON admin.users         TO financas_app;
GRANT INSERT, UPDATE, DELETE ON admin.clients       TO financas_app;
GRANT INSERT, UPDATE, DELETE ON admin.client_users  TO financas_app;

-- The app calls provision_tenant() to create new companies
GRANT EXECUTE ON FUNCTION admin.provision_tenant(TEXT, TEXT) TO financas_app;
