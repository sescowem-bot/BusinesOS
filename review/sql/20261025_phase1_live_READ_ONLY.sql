-- Phase 1 production snapshot; read-only.
SELECT tablename,policyname,permissive,cmd FROM pg_policies
WHERE schemaname='public' AND policyname LIKE 'businessos_phase1_%'
ORDER BY tablename,policyname;
SELECT proname,
 position('business_can_perform_action' in prosrc)>0 AS action_checked,
 position('business_plan_core_feature_allowed' in prosrc)>0 AS core_checked
FROM pg_proc WHERE pronamespace='public'::regnamespace
AND proname IN ('crm_create_customer','crm_record_payment','gl_record_paid_expense',
 'business_pos_checkout_split','crm_create_order_with_cost','gl_post_journal')
ORDER BY proname;
SELECT 'global_action' AS setting,enabled::text AS state FROM public.platform_plan_action_enforcement
UNION ALL SELECT 'global_usage',enabled::text FROM public.platform_usage_enforcement;
SELECT count(*) AS action_override_count FROM public.platform_plan_action_overrides;
