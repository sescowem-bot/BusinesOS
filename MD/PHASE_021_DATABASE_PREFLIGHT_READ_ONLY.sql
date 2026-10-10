-- BUSINESSOS Phase 021: READ-ONLY inspection, run in Supabase SQL Editor.
-- Do not install again if 001-020 completed. This only reports schema state.
-- Expected objects are based on source migrations 004, 016, 017, 018, 019 and 020.
WITH expected(kind, name, exists_ok) AS (
 VALUES
 ('table','public.public_site_pages', to_regclass('public.public_site_pages') IS NOT NULL),
 ('table','public.public_site_plans', to_regclass('public.public_site_plans') IS NOT NULL),
 ('table','public.business_upgrade_requests', to_regclass('public.business_upgrade_requests') IS NOT NULL),
 ('table','public.business_plan_assignments', to_regclass('public.business_plan_assignments') IS NOT NULL),
 ('table','public.platform_plan_features', to_regclass('public.platform_plan_features') IS NOT NULL),
 ('table','public.user_notifications', to_regclass('public.user_notifications') IS NOT NULL),
 ('table','public.notification_preferences', to_regclass('public.notification_preferences') IS NOT NULL),
 ('table','public.platform_email_templates', to_regclass('public.platform_email_templates') IS NOT NULL),
 ('function','public.create_my_business_workspace(text,text)',to_regprocedure('public.create_my_business_workspace(text,text)') IS NOT NULL),
 ('function','public.request_business_upgrade(uuid,text,text)',to_regprocedure('public.request_business_upgrade(uuid,text,text)') IS NOT NULL),
 ('function','public.review_business_upgrade(uuid,boolean,text)',to_regprocedure('public.review_business_upgrade(uuid,boolean,text)') IS NOT NULL),
 ('function','public.platform_business_directory()',to_regprocedure('public.platform_business_directory()') IS NOT NULL),
 ('function','public.admin_set_plan_feature(text,text,boolean)',to_regprocedure('public.admin_set_plan_feature(text,text,boolean)') IS NOT NULL),
 ('function','public.business_has_feature(uuid,text)',to_regprocedure('public.business_has_feature(uuid,text)') IS NOT NULL),
 ('function','public.set_notification_read(uuid,boolean)',to_regprocedure('public.set_notification_read(uuid,boolean)') IS NOT NULL)
)
SELECT kind, name, CASE WHEN exists_ok THEN 'PRESENT' ELSE 'MISSING' END AS status
FROM expected ORDER BY kind, name;

-- Ensure row-level security remains enabled on the Phase 017-020 sensitive tables.
SELECT c.relname AS object_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
AND c.relname IN ('business_upgrade_requests','business_plan_assignments',
                 'platform_plan_features','user_notifications',
                 'notification_preferences','platform_email_templates')
ORDER BY c.relname;

-- Verify that notification and upgrade triggers were created.
SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema='public'
  AND event_object_table='business_upgrade_requests'
ORDER BY trigger_name, event_manipulation;

-- This does not prove RLS semantics, active delivery hooks, production readiness,
-- or the permissions of an actual logged-in owner/staff user. Complete live testing.
