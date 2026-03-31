-- ============================================================
-- Migration 001: Admin schema — clients, users, roles, permissions
-- Run once against the target database.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS admin;

-- -------------------------------------------------------
-- Enum types
-- -------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE admin.module_name AS ENUM
    ('lancamentos', 'plano', 'saldos', 'importar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE admin.access_level AS ENUM ('read', 'write');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- Clients (tenants)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.clients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        NOT NULL UNIQUE,   -- schema name: "tenant_<slug>"
  name       TEXT        NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Users
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,       -- bcrypt, min 12 rounds
  display_name  TEXT,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Client membership — one user can belong to many clients
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.client_users (
  client_id UUID NOT NULL REFERENCES admin.clients(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES admin.users(id)   ON DELETE CASCADE,
  PRIMARY KEY (client_id, user_id)
);

-- -------------------------------------------------------
-- Roles (scoped to a client)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.roles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES admin.clients(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  UNIQUE (client_id, name)
);

-- -------------------------------------------------------
-- User-role assignment (scoped to a client)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.user_roles (
  user_id UUID NOT NULL REFERENCES admin.users(id)  ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES admin.roles(id)  ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- -------------------------------------------------------
-- Module permissions
-- write implies read; enforced in application middleware
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.role_permissions (
  role_id UUID               NOT NULL REFERENCES admin.roles(id) ON DELETE CASCADE,
  module  admin.module_name  NOT NULL,
  access  admin.access_level NOT NULL DEFAULT 'read',
  PRIMARY KEY (role_id, module)
);

-- -------------------------------------------------------
-- Refresh tokens (skeleton for future JWT auth)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES admin.users(id)    ON DELETE CASCADE,
  client_id  UUID        NOT NULL REFERENCES admin.clients(id)  ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_client
  ON admin.refresh_tokens (user_id, client_id)
  WHERE NOT revoked;

-- -------------------------------------------------------
-- Application roles (PostgreSQL-level)
-- Run as a superuser. Safe to run multiple times.
-- -------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_reader') THEN
    CREATE ROLE app_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_writer') THEN
    CREATE ROLE app_writer NOLOGIN INHERIT;
    GRANT app_reader TO app_writer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'financas_app') THEN
    -- Replace 'change_this_password' before running in production
    CREATE ROLE financas_app LOGIN PASSWORD 'change_this_password';
    GRANT app_writer TO financas_app;
  END IF;
END $$;

GRANT USAGE ON SCHEMA admin TO financas_app;
GRANT SELECT ON ALL TABLES IN SCHEMA admin TO financas_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA admin GRANT SELECT ON TABLES TO financas_app;
