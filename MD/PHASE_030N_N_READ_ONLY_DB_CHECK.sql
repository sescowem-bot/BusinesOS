-- BusinessOS Pricing + CMS Administration Readiness
-- READ-ONLY: safe to paste into Supabase SQL Editor. No data is modified.
-- This checks objects, not whether an individual authenticated action succeeds.
SELECT 'Plans table' AS check_name,
       to_regclass('public.public_site_plans') IS NOT NULL AS ready
UNION ALL
SELECT 'Monthly price column', EXISTS (
 SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='public_site_plans' AND column_name='price_monthly_ngn'
)
UNION ALL
SELECT 'Annual price column', EXISTS (
 SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='public_site_plans' AND column_name='price_yearly_ngn'
)
UNION ALL
SELECT 'Plan parent table (SQL 029)', to_regclass('public.plan_parent_links') IS NOT NULL
UNION ALL
SELECT 'Plan inheritance RPC (SQL 029)', to_regprocedure('public.admin_set_plan_parent(text,text)') IS NOT NULL
UNION ALL
SELECT 'Plan feature table', to_regclass('public.platform_plan_features') IS NOT NULL
UNION ALL
SELECT 'Website CMS pages table', to_regclass('public.public_site_pages') IS NOT NULL
UNION ALL
SELECT 'Plan audit table (SQL 049)', to_regclass('public.platform_plan_matrix_audit') IS NOT NULL
ORDER BY check_name;

-- Permission visibility for the inheritance function. This is NOT an authenticated-session test.
SELECT p.proname AS function_name,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_has_execute
FROM pg_proc p
JOIN pg_namespace ns ON ns.oid=p.pronamespace
WHERE ns.nspname='public'
 AND p.proname='admin_set_plan_parent';
