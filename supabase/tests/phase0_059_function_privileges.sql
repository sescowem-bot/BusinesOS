\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb, phone text);
CREATE TABLE IF NOT EXISTS public.profiles(id uuid PRIMARY KEY, full_name text, phone text);
CREATE TABLE IF NOT EXISTS public.engagement_campaigns(status text);

CREATE OR REPLACE FUNCTION public.gl_add_account(uuid,text,text,text) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION public.gl_can_manage(uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT true $$;
CREATE OR REPLACE FUNCTION public.gl_create_period(uuid,text,date,date) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT '00000000-0000-0000-0000-000000000002'::uuid $$;
CREATE OR REPLACE FUNCTION public.is_business_member(uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT true $$;
CREATE OR REPLACE FUNCTION public.is_business_owner(uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT true $$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles(id,full_name,phone)
  VALUES(NEW.id,COALESCE(NEW.raw_user_meta_data->>'full_name',''),NEW.phone)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.engagement_guard_campaign_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('draft','scheduled','cancelled') THEN RAISE EXCEPTION 'Sending disabled'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
DROP TRIGGER IF EXISTS enforce_campaign_safe_status ON public.engagement_campaigns;
CREATE TRIGGER enforce_campaign_safe_status BEFORE INSERT OR UPDATE ON public.engagement_campaigns
FOR EACH ROW EXECUTE FUNCTION public.engagement_guard_campaign_status();

\i supabase/migrations/059_restrict_internal_security_definer_functions.sql

DO $$
DECLARE fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.gl_add_account(uuid,text,text,text)'::regprocedure,
    'public.gl_can_manage(uuid)'::regprocedure,
    'public.gl_create_period(uuid,text,date,date)'::regprocedure,
    'public.is_business_member(uuid)'::regprocedure,
    'public.is_business_owner(uuid)'::regprocedure
  ] LOOP
    IF has_function_privilege('anon',fn,'EXECUTE') THEN
      RAISE EXCEPTION 'anon can still execute %',fn;
    END IF;
    IF NOT has_function_privilege('authenticated',fn,'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated lost execution on %',fn;
    END IF;
    IF NOT has_function_privilege('service_role',fn,'EXECUTE') THEN
      RAISE EXCEPTION 'service_role lost execution on %',fn;
    END IF;
  END LOOP;
  IF has_function_privilege('anon','public.handle_new_user()'::regprocedure,'EXECUTE')
     OR has_function_privilege('authenticated','public.handle_new_user()'::regprocedure,'EXECUTE')
     OR has_function_privilege('service_role','public.handle_new_user()'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'Auth trigger function still has direct API execution grants';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid='public.handle_new_user()'::regprocedure
      AND p.proconfig @> ARRAY['search_path=""']
  ) THEN RAISE EXCEPTION 'Auth trigger search_path was not locked'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid='public.engagement_guard_campaign_status()'::regprocedure
      AND p.proconfig @> ARRAY['search_path=""']
  ) THEN RAISE EXCEPTION 'Campaign trigger search_path was not locked'; END IF;
END $$;

-- Trigger smoke tests: both existing triggers must still execute after hardening.
INSERT INTO auth.users(id,raw_user_meta_data,phone)
VALUES('10000000-0000-0000-0000-000000000001','{"full_name":"Security Test"}'::jsonb,'0000000000');
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Auth user trigger stopped working';
  END IF;
  INSERT INTO public.engagement_campaigns(status) VALUES('draft');
  BEGIN
    INSERT INTO public.engagement_campaigns(status) VALUES('sending');
    RAISE EXCEPTION 'Campaign trigger allowed sending status';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Campaign trigger allowed sending status' THEN RAISE; END IF;
  END;
END $$;
SELECT 'Phase 0 SQL 059 function privilege and trigger tests passed' AS result;
