-- Non-destructive SQL to verify plan schema installation.
select 'public_site_plans' as object_name, to_regclass('public.public_site_plans') is not null as present
union all select 'platform_plan_features',to_regclass('public.platform_plan_features') is not null
union all select 'platform_plan_role_features',to_regclass('public.platform_plan_role_features') is not null
union all select 'business_plan_assignments',to_regclass('public.business_plan_assignments') is not null;
select proname as function_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in ('admin_save_plan_permissions','published_plan_features','business_has_feature')
order by proname;
