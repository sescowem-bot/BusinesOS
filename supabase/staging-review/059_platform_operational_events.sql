-- BusinessOS SQL 059: restricted operational event ledger (STAGING FIRST)
-- Prerequisite: platform_admins from migration 003.
-- No changes to existing pricing, users, payment activation or brand values.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.platform_admins') IS NULL THEN
   RAISE EXCEPTION 'Migration 003 (platform_admins) is required';
 END IF;
 IF to_regclass('public.platform_operational_events') IS NOT NULL THEN
   RAISE EXCEPTION 'Operational events table already exists; inspect before applying again';
 END IF;
END $$;

CREATE TABLE public.platform_operational_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source text NOT NULL CHECK (source IN ('paystack','resend','system')),
 event_key text NOT NULL CHECK (event_key ~ '^[a-z][a-z0-9_]{2,49}$'),
 outcome text NOT NULL CHECK (outcome IN ('success','warning','error')),
 reference_hash text CHECK (reference_hash IS NULL OR reference_hash ~ '^[0-9a-f]{12}$'),
 error_code text CHECK (error_code IS NULL OR error_code ~ '^[A-Za-z0-9_-]{1,48}$'),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_operational_events_recent
 ON public.platform_operational_events(recorded_at DESC);
CREATE INDEX platform_operational_events_source_recent
 ON public.platform_operational_events(source,recorded_at DESC);
ALTER TABLE public.platform_operational_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_operational_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_operational_events TO authenticated;
-- The service-role key is used only from backend/serverless code.
GRANT INSERT,SELECT ON public.platform_operational_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.platform_operational_events_id_seq TO service_role;
CREATE POLICY operational_events_platform_admin_read ON public.platform_operational_events
 FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active)
 );
-- No INSERT, UPDATE or DELETE grants for browser roles. Backend writes with
-- the existing secret service-role key only, never from browser code.
-- Existing platform_branding_audit already captures brand changes. Do not
-- replicate its complete JSON fields into operational events.
COMMIT;
