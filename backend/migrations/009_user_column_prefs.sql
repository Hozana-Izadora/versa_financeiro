-- ============================================================
-- Migration 009: Per-user UI preferences (e.g. visible columns
-- in Lançamentos), scoped to the user+client pair.
--
-- Stored as generic JSONB so future preferences don't need a
-- new migration each time — just a new key inside the object.
-- financas_app already has INSERT/UPDATE/DELETE on admin.client_users
-- (granted in 005_superadmin.sql), so no extra GRANT is needed here.
-- ============================================================

ALTER TABLE admin.client_users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
