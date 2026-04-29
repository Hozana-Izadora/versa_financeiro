-- ============================================================
-- Migration 003: Orçamento table
-- Adds orcamento to the provision_tenant function and creates
-- the table in all existing tenant schemas.
-- ============================================================

-- 1. Create orcamento in every existing tenant schema
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT slug FROM admin.clients LOOP
    EXECUTE format($t$
      CREATE TABLE IF NOT EXISTS %I.orcamento (
        id         BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        ano        SMALLINT      NOT NULL,
        mes        SMALLINT,
        tipo       TEXT          NOT NULL,
        referencia TEXT          NOT NULL DEFAULT '',
        valor      NUMERIC(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    $t$, 'tenant_' || r.slug);

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS orcamento_uq ON %I.orcamento(ano, COALESCE(mes, -1), tipo, referencia)',
      'tenant_' || r.slug
    );

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I.orcamento TO financas_app',
      'tenant_' || r.slug
    );
    EXECUTE format(
      'GRANT USAGE, SELECT ON %I.orcamento_id_seq TO financas_app',
      'tenant_' || r.slug
    );
  END LOOP;
END;
$$;

-- 2. Update provision_tenant to include orcamento for future tenants
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

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tx_regime_data ON %I.transactions (regime, data)', p_slug, v_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tx_cat ON %I.transactions (cat)', p_slug, v_schema);

  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.plano (
      id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      tipo  TEXT   NOT NULL UNIQUE,
      grp   TEXT   NOT NULL,
      cat   TEXT   NOT NULL,
      nivel TEXT   NOT NULL
    )
  $t$, v_schema);

  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.plano_cores (
      cat TEXT PRIMARY KEY,
      cor TEXT NOT NULL
    )
  $t$, v_schema);

  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.saldos_iniciais (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  $t$, v_schema);

  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.import_history (
      id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name        TEXT        NOT NULL,
      rows        INTEGER     NOT NULL,
      base        TEXT        NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  $t$, v_schema);

  -- orcamento (budget targets)
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.orcamento (
      id         BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ano        SMALLINT      NOT NULL,
      mes        SMALLINT,
      tipo       TEXT          NOT NULL,
      referencia TEXT          NOT NULL DEFAULT '',
      valor      NUMERIC(15,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
    )
  $t$, v_schema);

  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS orcamento_uq ON %I.orcamento(ano, COALESCE(mes, -1), tipo, referencia)',
    v_schema
  );

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
