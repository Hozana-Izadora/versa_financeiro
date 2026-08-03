-- ============================================================
-- Migration 010: Client logo — optional branding image per empresa
-- Stored as a data URI (base64) so no separate file storage/volume is needed.
-- ============================================================

ALTER TABLE admin.clients ADD COLUMN IF NOT EXISTS logo TEXT;
