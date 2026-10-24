-- BusinessOS action-permission readiness check; READ ONLY.
-- Safe to run in production: no DDL, no writes, no customer data.
SELECT 'action_permission_tables' AS check_name,
       to_regclass('public.platform_plan_action_overrides') IS NOT NULL AS installed,
       to_regclass('public.platform_plan_action_audit') IS NOT NULL AS audit_installed,
       to_regprocedure('public.admin_save_plan_action_matrix(text,text,jsonb,text)') IS NOT NULL AS audited_save_installed;
SELECT p.id AS plan_id,p.name,p.published,
       (SELECT count(*) FROM public.platform_plan_features f
         WHERE f.plan_id=p.id AND f.enabled) AS enabled_premium_modules,
       (SELECT count(*) FROM public.platform_plan_role_features r
         WHERE r.plan_id=p.id AND r.enabled) AS stored_role_preferences
FROM public.public_site_plans p
ORDER BY p.sort_order,p.id;
SELECT e.enumlabel AS database_role
FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public' AND t.typname='member_role'
ORDER BY e.enumsortorder;
