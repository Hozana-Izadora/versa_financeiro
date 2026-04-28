-- ============================================================
-- Migration 003: Saldos audit trail + rename -base → -abertura
-- ============================================================

-- ── 1. Update provision_tenant to include audit columns for new tenants ────────
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

  -- saldos_iniciais with audit columns
  -- chave = "YYYY-abertura" (opening balance) or "YYYY-MM" (monthly adjustment)
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.saldos_iniciais (
      chave      TEXT          PRIMARY KEY,
      valor      TEXT          NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ   DEFAULT now()
    )
  $t$, v_schema);

  -- Audit log for saldo changes
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.saldo_audit_log (
      id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      chave       TEXT        NOT NULL,
      old_valor   TEXT,
      new_valor   TEXT,
      operacao    TEXT        NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
      changed_by  TEXT        NOT NULL,
      changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- ── 2. Patch all existing tenant schemas ──────────────────────────────────────
DO $$
DECLARE
  r        RECORD;
  v_schema TEXT;
BEGIN
  FOR r IN SELECT slug FROM admin.clients LOOP
    v_schema := 'tenant_' || r.slug;

    -- Add audit columns (safe to re-run)
    EXECUTE format('ALTER TABLE %I.saldos_iniciais ADD COLUMN IF NOT EXISTS updated_by TEXT', v_schema);
    EXECUTE format('ALTER TABLE %I.saldos_iniciais ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()', v_schema);

    -- Rename YYYY-base → YYYY-abertura (fix naming inconsistency with dreBuilder)
    EXECUTE format(
      'UPDATE %I.saldos_iniciais SET chave = substring(chave, 1, 4) || ''-abertura'' WHERE chave LIKE ''____-base''',
      v_schema
    );

    -- Create audit log table
    EXECUTE format($t$
      CREATE TABLE IF NOT EXISTS %I.saldo_audit_log (
        id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        chave       TEXT        NOT NULL,
        old_valor   TEXT,
        new_valor   TEXT,
        operacao    TEXT        NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
        changed_by  TEXT        NOT NULL,
        changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    $t$, v_schema);

    -- Grant access on any newly created objects
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO financas_app', v_schema);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO financas_app', v_schema);

    RAISE NOTICE 'Patched tenant schema: %', v_schema;
  END LOOP;
END $$;
