#!/bin/sh
set -e

if [ -z "$POSTGRES_APP_PASSWORD" ]; then
  echo "ERROR: POSTGRES_APP_PASSWORD is not set." >&2
  exit 1
fi

ESCAPED_PW=$(printf '%s' "$POSTGRES_APP_PASSWORD" | sed "s/'/''/g")

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname   "$POSTGRES_DB" \
     <<-EOSQL
  -- 1. PRIMEIRO: Criar as Roles e o Usuário
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
      CREATE ROLE app_reader NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_writer') THEN
      CREATE ROLE app_writer NOLOGIN INHERIT;
      GRANT app_reader TO app_writer;
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'financas_app') THEN
      CREATE ROLE financas_app LOGIN PASSWORD '$ESCAPED_PW';
      GRANT app_writer TO financas_app;
    ELSE
      ALTER ROLE financas_app PASSWORD '$ESCAPED_PW';
    END IF;
  END
  \$\$;

  -- 2. SEGUNDO: Dar as permissões (Agora que o usuário existe!)
  ALTER DATABASE "$POSTGRES_DB" OWNER TO financas_app;
  GRANT ALL ON SCHEMA public TO financas_app;
  ALTER SCHEMA public OWNER TO financas_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO financas_app;
EOSQL

echo "financas_app role and schema permissions ready."