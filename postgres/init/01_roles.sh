#!/bin/sh
# Runs once on first database initialisation (when the pgdata volume is empty).
# Creates the application role used by the backend.
# POSTGRES_APP_PASSWORD must be set in the environment.

set -e

if [ -z "$POSTGRES_APP_PASSWORD" ]; then
  echo "ERROR: POSTGRES_APP_PASSWORD is not set. Cannot create financas_app role." >&2
  exit 1
fi

# Escape single quotes in the password (SQL string literal escaping)
ESCAPED_PW=$(printf '%s' "$POSTGRES_APP_PASSWORD" | sed "s/'/''/g")

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname   "$POSTGRES_DB" \
     <<-EOSQL
  -- Application roles (coarse DB-level access)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
      CREATE ROLE app_reader NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_writer') THEN
      CREATE ROLE app_writer NOLOGIN INHERIT;
      GRANT app_reader TO app_writer;
    END IF;
  END
  \$\$;

  -- Login role for the Node.js backend
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'financas_app') THEN
      CREATE ROLE financas_app LOGIN PASSWORD '$ESCAPED_PW';
      GRANT app_writer TO financas_app;
    ELSE
      -- Update password in case it changed
      ALTER ROLE financas_app PASSWORD '$ESCAPED_PW';
    END IF;
  END
  \$\$;
EOSQL

echo "financas_app role ready."
