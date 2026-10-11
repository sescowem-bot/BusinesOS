-- BusinessOS SQL 044 read-only audit. Safe before or after migration.
-- This section checks pg_catalog, so it will not fail just because migration 044 is missing.
SELECT 'plan numeric monthly price' AS check_name, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='public_site_plans' AND column_name='price_monthly_ngn') AS present
UNION ALL SELECT 'plan numeric annual price',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='public_site_plans' AND column_name='price_yearly_ngn')
UNION ALL SELECT 'company-specific module prices',to_regclass('public.business_feature_prices') IS NOT NULL
UNION ALL SELECT 'company module price audit',to_regclass('public.business_feature_price_audit') IS NOT NULL
UNION ALL SELECT 'named company role profiles',to_regclass('public.business_company_role_profiles') IS NOT NULL
UNION ALL SELECT 'named company role assignments',to_regclass('public.business_company_role_assignments') IS NOT NULL
UNION ALL SELECT 'company role audit',to_regclass('public.business_company_role_audit') IS NOT NULL
UNION ALL SELECT 'Free cleanup audit',to_regclass('public.platform_free_plan_cleanup_audit') IS NOT NULL
UNION ALL SELECT 'Free module prevention trigger',EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='keep_free_core_only' AND NOT tgisinternal)
UNION ALL SELECT 'Free plan inheritance prevention',EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='keep_free_without_parent' AND NOT tgisinternal)
UNION ALL SELECT 'Free plan zero-cost guard',EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='free_prices_remain_zero' AND NOT tgisinternal)
UNION ALL SELECT 'admin save company role RPC',to_regprocedure('public.admin_save_company_role(uuid,uuid,text,text,text,text[],boolean)') IS NOT NULL
UNION ALL SELECT 'admin assign company role RPC',to_regprocedure('public.admin_assign_company_role(uuid,uuid,uuid)') IS NOT NULL
UNION ALL SELECT 'admin clear company role RPC',to_regprocedure('public.admin_clear_company_role(uuid,uuid)') IS NOT NULL
UNION ALL SELECT 'admin company price RPC',to_regprocedure('public.admin_set_business_feature_price(uuid,text,numeric,numeric,text)') IS NOT NULL;

-- Actual Free paid-module rows BEFORE or AFTER migration 044. Nonzero = investigate.
SELECT f.plan_id,f.feature_key,f.enabled FROM public.platform_plan_features f
 WHERE f.plan_id='free' AND f.enabled ORDER BY feature_key;
-- Nonempty = Free inherits something and needs review.
SELECT plan_id,parent_plan_id FROM public.plan_parent_links WHERE plan_id='free';
-- Explicit grants for Free businesses are separate from Free entitlements (review, do not automatically delete).
SELECT g.business_id,g.feature_key,g.enabled,g.expires_at,g.allowed_roles,g.note
 FROM public.business_feature_grants g JOIN public.business_plan_assignments a ON a.business_id=g.business_id
 WHERE a.plan_id='free' AND g.enabled ORDER BY g.business_id,g.feature_key LIMIT 100;
-- After migration 044, verify RLS on the new tables (before migration the result is empty).
SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('business_company_role_profiles','business_company_role_assignments','business_company_role_audit','business_feature_prices','business_feature_price_audit','platform_free_plan_cleanup_audit') ORDER BY c.relname;
