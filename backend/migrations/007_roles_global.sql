-- Roles are now global (not scoped to a client).
-- client_id becomes nullable so roles can be created without a company.
ALTER TABLE admin.roles ALTER COLUMN client_id DROP NOT NULL;
