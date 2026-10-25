-- APPLIED IN PRODUCTION: 20261025212905 (businessos_phase1e_revoke_data_api_table_ddl_privileges).
-- ARCHIVAL COPY ONLY; DO NOT EXECUTE OR REPLAY.
-- Captured from supabase_migrations.schema_migrations on 25 October 2026.

-- Phase 1E: RLS never authorizes TRUNCATE, TRIGGER or REFERENCES.
-- These privileges are unnecessary for browser/API roles and bypass row-action checks.
-- Normal SELECT/INSERT/UPDATE/DELETE grants and service_role privileges are untouched.
BEGIN;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
COMMIT;
