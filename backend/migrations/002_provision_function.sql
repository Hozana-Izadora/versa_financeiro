-- ============================================================
-- Migration 002: Tenant provisioning function
-- Creates admin.provision_tenant(slug, name) which:
--   1. Creates a new schema "tenant_<slug>"
--   2. Creates all per-tenant tables inside it
--   3. Grants access to the financas_app role
--   4. Inserts the client record into admin.clients
--   Returns the new client UUID.
-- ============================================================

CREATE OR REPLACE FUNCTION admin.provision_tenant(
  p_slug TEXT,
  p_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id UUID;
  v_schema    TEXT := 'tenant_' || p_slug;
BEGIN
  -- Validate slug: lowercase letters, digits, underscore; starts with letter
  IF p_slug !~ '^[a-z][a-z0-9_]{1,62}$' THEN
    RAISE EXCEPTION 'Invalid slug "%". Use only lowercase letters, digits, and underscores.', p_slug;
  END IF;

  -- Guard against double-provisioning
  IF EXISTS (SELECT 1 FROM admin.clients WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Tenant with slug "%" already exists.', p_slug;
  END IF;

  -- Create schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema);

  -- -------------------------------------------------------
  -- transactions
  -- -------------------------------------------------------
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.transactions (
      id         BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      data       DATE            NOT NULL,
      descricao  TEXT            NOT NULL,
      cat        TEXT            NOT NULL,
      grp        TEXT            NOT NULL,
      tipo       TEXT            NOT NULL,
      nivel      TEXT            NOT NULL,
      valor      NUMERIC(15,2)   NOT NULL CHECK (valor >= 0),
      mov        TEXT            NOT NULL CHECK (mov IN ('Entrada', 'Saída')),
      regime     TEXT            NOT NULL CHECK (regime IN ('Caixa', 'Competência')),
      created_at TIMESTAMPTZ     NOT NULL DEFAULT now()
    )
  $t$, v_schema);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tx_regime_data ON %I.transactions (regime, data)',
    p_slug, v_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tx_cat ON %I.transactions (cat)',
    p_slug, v_schema);

  -- -------------------------------------------------------
  -- plano (chart of accounts)
  -- -------------------------------------------------------
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.plano (
      id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      tipo  TEXT   NOT NULL UNIQUE,
      grp   TEXT   NOT NULL,
      cat   TEXT   NOT NULL,
      nivel TEXT   NOT NULL
    )
  $t$, v_schema);

  -- -------------------------------------------------------
  -- plano_cores (category → colour)
  -- -------------------------------------------------------
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.plano_cores (
      cat TEXT PRIMARY KEY,
      cor TEXT NOT NULL
    )
  $t$, v_schema);

  -- -------------------------------------------------------
  -- saldos_iniciais
  -- chave = "YYYY-base" (regime base) or "YYYY-MM" (monthly balance)
  -- valor stores the numeric balance; for "YYYY-base" the value encodes
  -- the regime as 1 (Caixa) or 2 (Competência) — decoded in application layer
  -- -------------------------------------------------------
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.saldos_iniciais (
      chave TEXT          PRIMARY KEY,
      valor TEXT          NOT NULL
    )
  $t$, v_schema);

  -- -------------------------------------------------------
  -- import_history
  -- -------------------------------------------------------
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.import_history (
      id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name        TEXT        NOT NULL,
      rows        INTEGER     NOT NULL,
      base        TEXT        NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  $t$, v_schema);

  -- Grant access to application role
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO financas_app', v_schema);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO financas_app', v_schema);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO financas_app', v_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO financas_app', v_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO financas_app', v_schema);

  -- Register client
  INSERT INTO admin.clients (slug, name)
  VALUES (p_slug, p_name)
  RETURNING id INTO v_client_id;

  RAISE NOTICE 'Tenant "%" provisioned. Schema: %. Client ID: %', p_name, v_schema, v_client_id;
  RETURN v_client_id;
END;
$$;

-- ============================================================
-- Deprovision helper (drops schema + removes client record)
-- Use with caution — irreversible.
-- ============================================================
CREATE OR REPLACE FUNCTION admin.deprovision_tenant(p_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schema TEXT := 'tenant_' || p_slug;
BEGIN
  IF p_slug !~ '^[a-z][a-z0-9_]{1,62}$' THEN
    RAISE EXCEPTION 'Invalid slug "%"', p_slug;
  END IF;

  EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', v_schema);
  DELETE FROM admin.clients WHERE slug = p_slug;

  RAISE NOTICE 'Tenant "%" deprovisioned.', p_slug;
END;
$$;
