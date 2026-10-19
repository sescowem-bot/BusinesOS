-- BusinessOS pricing preflight (READ ONLY).
-- Run in Supabase SQL Editor; share ONLY the results, never credentials or JWTs.
-- This does not create or change objects.
SELECT
 to_regclass('public.public_site_plans') IS NOT NULL AS has_public_site_plans,
 to_regclass('public.plan_parent_links') IS NOT NULL AS has_plan_parent_links,
 to_regclass('public.business_upgrade_requests') IS NOT NULL AS has_upgrade_requests,
 to_regclass('public.business_admin_plan_audit') IS NOT NULL AS has_manual_assignment_audit,
 to_regclass('public.legal_document_versions') IS NOT NULL AS has_legal_evidence,
 to_regprocedure('public.admin_set_plan_parent(text,text)') IS NOT NULL AS has_parent_change_rpc,
 to_regprocedure('public.review_business_upgrade(uuid,boolean,text)') IS NOT NULL AS has_review_rpc,
 to_regprocedure('public.admin_assign_business_subscription(uuid,text,text,timestamptz)') IS NOT NULL AS has_manual_assignment_rpc,
 to_regprocedure('public.activate_paid_business_plan(text,bigint,text,bigint)') IS NOT NULL AS has_verified_activation_rpc,
 to_regprocedure('public.admin_subscription_diagnostics()') IS NOT NULL AS has_sql_053_health_rpc;

SELECT column_name,data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='public_site_plans'
AND column_name IN ('id','name','published','price_monthly_ngn','price_yearly_ngn','updated_at','updated_by')
ORDER BY column_name;

-- Only the first two SELECTs are needed to diagnose missing migrations.
-- A successful object-existence result does not validate runtime grants,
-- user roles, Paystack configuration or migration completion.
