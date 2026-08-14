-- ============================================================
-- Migration 011: Fix table creation order in admin.provision_tenant()
--
-- Bug: both 002_provision_function.sql and 008_transaction_extra_fields.sql
-- create the "transactions" table (which has a FK to import_history.id)
-- BEFORE creating the "import_history" table itself, inside the same
-- function body. Provisioning any new tenant fails with:
--   relation "tenant_<slug>.import_history" does not exist
--
-- Fix: same function body as 008, with import_history created first.
-- Existing tenants are unaffected — this only changes how FUTURE
-- tenants are provisioned.
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
  IF p_slug !~ '^[a-z][a-z0-9_]{1,62}$' THEN
    RAISE EXCEPTION 'Invalid slug "%". Use only lowercase letters, digits, and underscores.', p_slug;
  END IF;

  IF EXISTS (SELECT 1 FROM admin.clients WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Tenant with slug "%" already exists.', p_slug;
  END IF;

  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema);

  -- -------------------------------------------------------
  -- import_history (created first — transactions references it)
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

  -- -------------------------------------------------------
  -- transactions
  -- -------------------------------------------------------
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.transactions (
      id               BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      data             DATE            NOT NULL,
      descricao        TEXT            NOT NULL,
      cat              TEXT            NOT NULL,
      grp              TEXT            NOT NULL,
      tipo             TEXT            NOT NULL,
      nivel            TEXT            NOT NULL,
      valor            NUMERIC(15,2)   NOT NULL CHECK (valor >= 0),
      mov              TEXT            NOT NULL,
      regime           TEXT            NOT NULL CHECK (regime IN ('Caixa', 'Competência')),
      fornecedor       TEXT,
      data_emissao     DATE,
      data_vencimento  DATE,
      extra            JSONB           NOT NULL DEFAULT '{}'::jsonb,
      import_id        BIGINT          REFERENCES %I.import_history(id) ON DELETE SET NULL,
      created_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
    )
  $t$, v_schema, v_schema);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tx_regime_data ON %I.transactions (regime, data)',
    p_slug, v_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tx_import_id ON %I.transactions (import_id)',
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
  -- -------------------------------------------------------
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.saldos_iniciais (
      chave TEXT          PRIMARY KEY,
      valor TEXT          NOT NULL
    )
  $t$, v_schema);

  EXECUTE format('GRANT USAGE ON SCHEMA %I TO financas_app', v_schema);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO financas_app', v_schema);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO financas_app', v_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO financas_app', v_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO financas_app', v_schema);

  INSERT INTO admin.clients (slug, name)
  VALUES (p_slug, p_name)
  RETURNING id INTO v_client_id;

  RAISE NOTICE 'Tenant "%" provisioned. Schema: %. Client ID: %', p_name, v_schema, v_client_id;
  RETURN v_client_id;
END;
$$;
