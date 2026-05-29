-- Adds description, permissions and created_at to the existing admin.roles table
-- (created in 001_admin_schema.sql with id UUID)
ALTER TABLE admin.roles
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();

-- Associates a role (UUID) with each user-client pair
ALTER TABLE admin.client_users
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES admin.roles(id) ON DELETE SET NULL;
