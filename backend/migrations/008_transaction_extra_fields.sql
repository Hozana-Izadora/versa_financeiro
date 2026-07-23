-- ============================================================
-- Migration 008: Fornecedor, Data Emissão, Data Vencimento e
-- campo flexível "extra" (JSONB) em transactions.
--
-- "extra" guarda colunas que variam por cliente na importação
-- (ex: Centro de Custo, Nº Documento) sem exigir alteração de
-- schema a cada campo novo.
--
-- REQUIRES: run as postgres superuser (not financas_app).
--
-- Via Docker:
--   docker compose exec db psql -U postgres -d financas \
--     -c "$(cat backend/migrations/008_transaction_extra_fields.sql)"
--
-- Via psql directly:
--   psql -U postgres -d financas -f backend/migrations/008_transaction_extra_fields.sql
--
-- Same per-tenant loop pattern as migration 004: each tenant is wrapped
-- in its own BEGIN/EXCEPTION so a single failure doesn't abort the rest.
-- ============================================================

DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT 'tenant_' || c.slug
      FROM admin.clients c
     WHERE c.active = true
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.transactions
           ADD COLUMN IF NOT EXISTS fornecedor       TEXT,
           ADD COLUMN IF NOT EXISTS data_emissao      DATE,
           ADD COLUMN IF NOT EXISTS data_vencimento   DATE,
           ADD COLUMN IF NOT EXISTS extra             JSONB NOT NULL DEFAULT ''{}''::jsonb',
        s
      );
      RAISE NOTICE 'Migration 008 applied to schema %', s;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Migration 008 skipped for schema % — %: %',
        s, SQLERRM, SQLSTATE;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Redefine admin.provision_tenant() so NEW tenants get the columns
-- from the start. Full function body copied from 002_provision_function.sql
-- with the four columns added to the transactions table.
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
