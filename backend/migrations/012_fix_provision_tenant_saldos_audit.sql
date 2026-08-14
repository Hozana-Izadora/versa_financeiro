-- ============================================================
-- Migration 012: Restore saldos audit columns/table dropped by 008/011
--
-- History of admin.provision_tenant() redefinitions:
--   002 — original (transactions created before import_history — bug)
--   003 — added saldos_iniciais.updated_by/updated_at + saldo_audit_log
--          table, and patched all existing tenants at the time
--   008 — redefined the function again (to add fornecedor/data_emissao/
--          data_vencimento/extra + import_id), but was based on an
--          earlier copy that PRE-DATES 003 — silently dropping the
--          saldos audit columns/table for any tenant created since
--   011 — fixed the import_history-before-transactions ordering bug,
--          but copied 008's (already regressed) body, carrying the
--          same gap forward
--
-- Net effect: every tenant provisioned since 008 was applied is missing
-- saldos_iniciais.updated_by / updated_at and the saldo_audit_log table,
-- causing "column updated_by does not exist" / "relation saldo_audit_log
-- does not exist" on the Saldos Iniciais tab.
--
-- This migration is the single source of truth going forward: full
-- function body with every column/table from 002+003+004+008+011 combined,
-- correct table creation order, PLUS a patch loop for tenants already
-- provisioned with the incomplete 008/011 version.
-- ============================================================

-- ── 1. Patch existing tenants missing the saldos audit columns/table ──────────
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
      EXECUTE format('ALTER TABLE %I.saldos_iniciais ADD COLUMN IF NOT EXISTS updated_by TEXT', s);
      EXECUTE format('ALTER TABLE %I.saldos_iniciais ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()', s);
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
      $t$, s);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO financas_app', s);
      EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO financas_app', s);
      RAISE NOTICE 'Migration 012 patched schema %', s;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Migration 012 skipped for schema % — %: %', s, SQLERRM, SQLSTATE;
    END;
  END LOOP;
END $$;

-- ── 2. Redefine provision_tenant with every accumulated feature, correctly ordered ──
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
  -- saldos_iniciais — chave = "YYYY-abertura" or "YYYY-MM", with audit columns
  -- -------------------------------------------------------
  EXECUTE format($t$
    CREATE TABLE IF NOT EXISTS %I.saldos_iniciais (
      chave      TEXT          PRIMARY KEY,
      valor      TEXT          NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ   DEFAULT now()
    )
  $t$, v_schema);

  -- -------------------------------------------------------
  -- saldo_audit_log — audit trail for saldos_iniciais changes
  -- -------------------------------------------------------
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
