\set ON_ERROR_STOP on
-- Run ONLY against a disposable local/postgres CI database.
-- This test executes the SQL and attempts real anonymous and authenticated reads/writes.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE public.subscription_plans (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE public.partner_organizations (id text PRIMARY KEY, name text NOT NULL);
INSERT INTO public.subscription_plans VALUES ('legacy-plan', 'Historic catalog');
INSERT INTO public.partner_organizations VALUES ('legacy-partner', 'Historic organization');
-- Simulate the dangerous historical exposure before the repair.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans,
  public.partner_organizations TO PUBLIC, anon, authenticated;

\i supabase/migrations/057_lock_down_legacy_catalog_tables.sql
-- Rerunning is deliberate here: non-destructive/idempotent schema hardening.
\i supabase/migrations/057_lock_down_legacy_catalog_tables.sql

DO $$
DECLARE v_table text;
BEGIN
  FOR v_table IN SELECT unnest(ARRAY['subscription_plans','partner_organizations']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_table AND c.relrowsecurity
    ) THEN RAISE EXCEPTION 'RLS not enabled on %', v_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=v_table) THEN
      RAISE EXCEPTION 'Unexpected policy on %', v_table;
    END IF;
    IF has_table_privilege('anon',format('public.%I',v_table),'SELECT') OR
       has_table_privilege('authenticated',format('public.%I',v_table),'SELECT') OR
       has_table_privilege('authenticated',format('public.%I',v_table),'INSERT') THEN
      RAISE EXCEPTION 'Unsafe table privilege retained on %', v_table;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.subscription_plans)<>1 OR
     (SELECT count(*) FROM public.partner_organizations)<>1 THEN
    RAISE EXCEPTION 'Hardening erased or changed legacy catalog records';
  END IF;
END $$;

BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM id FROM public.subscription_plans LIMIT 1;
    RAISE EXCEPTION 'anon SELECT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.partner_organizations VALUES ('unauthorized','No');
    RAISE EXCEPTION 'anon INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM id FROM public.partner_organizations LIMIT 1;
    RAISE EXCEPTION 'authenticated SELECT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.subscription_plans SET name='Changed' WHERE id='legacy-plan';
    RAISE EXCEPTION 'authenticated UPDATE was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;

DO $$
BEGIN
  IF (SELECT name FROM public.subscription_plans WHERE id='legacy-plan') <> 'Historic catalog'
  THEN RAISE EXCEPTION 'Failed authorization changed data'; END IF;
END $$;
SELECT 'Phase 0 SQL 057 execution tests passed' AS result;
