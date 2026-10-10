-- BusinessOS SQL 028 (Phase 030) READ-ONLY check.
-- Does not install, alter or delete any objects.
WITH items AS (
 SELECT 'table' AS kind,'platform_pilot_results' AS object_name, to_regclass('public.platform_pilot_results') IS NOT NULL AS present
 UNION ALL SELECT 'table','platform_pilot_audit',to_regclass('public.platform_pilot_audit') IS NOT NULL
 UNION ALL SELECT 'function','platform_record_pilot_check(text,text,text,text)',
  to_regprocedure('public.platform_record_pilot_check(text,text,text,text)') IS NOT NULL
)
SELECT kind,object_name,CASE WHEN present THEN 'PRESENT' ELSE 'MISSING' END AS status FROM items ORDER BY kind,object_name;

-- Check RLS is enabled on both new tables.
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('platform_pilot_results','platform_pilot_audit')
ORDER BY c.relname;

-- Look at actual policies, not just table presence.
SELECT tablename,policyname,cmd,roles
FROM pg_policies WHERE schemaname='public'
 AND tablename IN ('platform_pilot_results','platform_pilot_audit')
ORDER BY tablename,policyname;

-- The following query is optional: run only if both pilot tables are PRESENT.
-- It is commented out intentionally, so this diagnostic never errors on a fresh project.
-- SELECT environment,status,count(*) AS total FROM public.platform_pilot_results
-- GROUP BY environment,status ORDER BY environment,status;
