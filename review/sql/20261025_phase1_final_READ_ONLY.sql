-- BusinessOS Phase 1 permission release: production READ-ONLY verification.
-- These SELECT queries create no business records or payment transactions.
SELECT (SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND (policyname LIKE 'businessos_phase1_%' OR policyname LIKE 'businessos_phase1d_%')) AS installed_action_rls_policies,
 (SELECT count(DISTINCT tablename) FROM pg_policies WHERE schemaname='public'
  AND (policyname LIKE 'businessos_phase1_%' OR policyname LIKE 'businessos_phase1d_%')) AS protected_tables;
SELECT count(*) FILTER(WHERE prosrc LIKE '%business_can_perform_action%') AS callable_privileged_functions_with_action_checks,
 count(*) AS callable_privileged_functions_total
 FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef
 AND has_function_privilege('authenticated',oid,'EXECUTE');
SELECT proname,prosrc LIKE '%business_can_perform_action%' AS has_action_gate
 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
 ('crm_create_customer','crm_record_payment','gl_record_paid_expense',
 'crm_create_order_with_cost','issue_business_invoice','business_pos_checkout_split',
 'business_complete_pos_return','catalog_create_item','gl_post_journal',
 'business_create_purchase','business_update_team_role','business_can_perform_action')
 ORDER BY proname;
SELECT enabled,reason FROM public.platform_plan_action_enforcement;
SELECT count(*) AS configured_action_overrides FROM public.platform_plan_action_overrides;
SELECT p.id AS plan,l.parent_plan_id AS parent
 FROM public.public_site_plans p LEFT JOIN public.plan_parent_links l ON l.plan_id=p.id
 ORDER BY p.id;
SELECT plan_id,count(*) FILTER(WHERE enabled) AS core_features_enabled,count(*) AS configured_core_features
 FROM public.platform_plan_core_features GROUP BY plan_id ORDER BY plan_id;
