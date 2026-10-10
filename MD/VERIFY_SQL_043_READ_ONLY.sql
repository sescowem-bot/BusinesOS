-- Read-only Supabase SQL Editor status for default Free plan SQL 043.
SELECT 'Published Free plan' AS check_name,
 EXISTS(SELECT 1 FROM public.public_site_plans WHERE id='free' AND published=true) AS pass
UNION ALL SELECT 'Auto-assignment trigger installed',EXISTS(
 SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='businesses'
 AND t.tgname='business_auto_assign_free_plan' AND NOT t.tgisinternal)
UNION ALL SELECT 'Auto-assignment function installed',
 to_regprocedure('public.assign_default_free_plan()') IS NOT NULL
UNION ALL SELECT 'Every existing business has a plan',NOT EXISTS(
 SELECT 1 FROM public.businesses b LEFT JOIN public.business_plan_assignments p ON p.business_id=b.id
 WHERE p.business_id IS NULL);

SELECT a.plan_id,COUNT(*) AS number_of_businesses
 FROM public.business_plan_assignments a GROUP BY a.plan_id ORDER BY a.plan_id;

-- Expect ZERO unassigned businesses after migration 043.
SELECT b.id,b.name,b.created_at FROM public.businesses b
LEFT JOIN public.business_plan_assignments a ON a.business_id=b.id
WHERE a.business_id IS NULL ORDER BY b.created_at DESC LIMIT 100;
