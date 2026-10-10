-- Phase 030I read-only Supabase SQL editor verification. Never installs or changes data.
SELECT 'business_pos_returns' AS object, to_regclass('public.business_pos_returns') IS NOT NULL AS installed
UNION ALL SELECT 'business_pos_refunds',to_regclass('public.business_pos_refunds') IS NOT NULL
UNION ALL SELECT 'business_pos_credit_notes',to_regclass('public.business_pos_credit_notes') IS NOT NULL
UNION ALL SELECT 'business_request_pos_return',to_regprocedure('public.business_request_pos_return(uuid,uuid,uuid,numeric,text,uuid)') IS NOT NULL
UNION ALL SELECT 'business_review_pos_return',to_regprocedure('public.business_review_pos_return(uuid,uuid,boolean,text)') IS NOT NULL
UNION ALL SELECT 'business_complete_pos_return',to_regprocedure('public.business_complete_pos_return(uuid,uuid,text,text,boolean)') IS NOT NULL;

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
  has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_can_select,
  has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_can_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_can_update,
  has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('business_pos_returns','business_pos_refunds','business_pos_credit_notes')
ORDER BY c.relname;

SELECT tablename,policyname,cmd,roles,qual FROM pg_policies
WHERE schemaname='public' AND tablename IN ('business_pos_returns','business_pos_refunds','business_pos_credit_notes')
ORDER BY tablename,policyname;

SELECT p.proname,p.prosecdef AS security_definer,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('business_request_pos_return','business_review_pos_return','business_complete_pos_return')
ORDER BY p.proname;
