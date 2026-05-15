-- ============================================================
-- Migration 004: Add import_id to transactions
-- Links each transaction to its originating import batch so that
-- a single import can be reversed without touching other data.
--
-- REQUIRES: run as postgres superuser (not financas_app).
--
-- Via Docker:
--   docker compose exec db psql -U postgres -d financas \
--     -c "$(cat backend/migrations/004_import_id.sql)"
--
-- Via psql directly:
--   psql -U postgres -d financas -f backend/migrations/004_import_id.sql
--
-- The DO block wraps each tenant in its own BEGIN/EXCEPTION so that
-- a single failure does not abort the others. Tenants already migrated
-- (column exists) are silently skipped via IF NOT EXISTS.
-- ============================================================

DO $$
DECLARE
  s    TEXT;
  slug TEXT;
BEGIN
  FOR s, slug IN
    SELECT 'tenant_' || c.slug, c.slug
      FROM admin.clients c
     WHERE c.active = true
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.transactions
           ADD COLUMN IF NOT EXISTS import_id BIGINT
           REFERENCES %I.import_history(id) ON DELETE SET NULL',
        s, s
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_tx_import_id ON %I.transactions (import_id)',
        slug, s
      );
      RAISE NOTICE 'Migration 004 applied to schema %', s;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Migration 004 skipped for schema % — %: %',
        s, SQLERRM, SQLSTATE;
    END;
  END LOOP;
END $$;
