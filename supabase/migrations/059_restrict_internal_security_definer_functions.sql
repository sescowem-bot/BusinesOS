-- BusinessOS production SQL 059: restrict anonymous execution of internal SECURITY DEFINER functions.
-- Public directory and published-plan RPCs are intentionally left public.
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.gl_add_account(uuid,text,text,text)') IS NULL
     OR to_regprocedure('public.gl_can_manage(uuid)') IS NULL
     OR to_regprocedure('public.gl_create_period(uuid,text,date,date)') IS NULL
     OR to_regprocedure('public.is_business_member(uuid)') IS NULL
     OR to_regprocedure('public.is_business_owner(uuid)') IS NULL
     OR to_regprocedure('public.handle_new_user()') IS NULL
     OR to_regprocedure('public.engagement_guard_campaign_status()') IS NULL THEN
    RAISE EXCEPTION 'Expected security functions are missing; stop and reconcile the live schema.';
  END IF;
END $$;

-- These functions are intended for authenticated tenant workflows, not anonymous callers.
REVOKE ALL ON FUNCTION public.gl_add_account(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gl_add_account(uuid,text,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gl_can_manage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gl_can_manage(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gl_create_period(uuid,text,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gl_create_period(uuid,text,date,date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_business_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_business_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid) TO authenticated, service_role;

-- This SECURITY DEFINER function is an auth.users trigger only, never a public RPC.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
ALTER FUNCTION public.handle_new_user() SET search_path = '';

-- Keep the existing trigger behavior while making its name resolution deterministic.
ALTER FUNCTION public.engagement_guard_campaign_status() SET search_path = '';
COMMIT;
