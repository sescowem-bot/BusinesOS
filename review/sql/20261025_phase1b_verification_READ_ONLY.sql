-- Phase 1B verification: READ ONLY, no test records or writes.
SELECT count(*) AS installed_phase1b_policies FROM pg_policies
 WHERE schemaname='public' AND policyname IN (
 'businessos_core_customer_link_insert','businessos_core_customer_link_update',
 'businessos_core_customer_link_delete','businessos_core_expense_insert',
 'businessos_core_expense_update','businessos_core_expense_delete');
SELECT tablename,policyname,permissive,cmd FROM pg_policies
 WHERE schemaname='public' AND policyname LIKE 'businessos_core_%'
 ORDER BY tablename,policyname;
SELECT 'action_switch' AS setting,enabled FROM public.platform_plan_action_enforcement WHERE id=true
UNION ALL SELECT 'usage_switch',enabled FROM public.platform_usage_enforcement WHERE id=true;
SELECT 'customer_rpc' AS name,has_function_privilege('authenticated','public.crm_create_customer(uuid,text,text,text)','EXECUTE') AS executable
UNION ALL SELECT 'payment_rpc',has_function_privilege('authenticated','public.crm_record_payment(uuid,uuid,numeric,public.payment_method,text)','EXECUTE')
UNION ALL SELECT 'expenses_rpc',has_function_privilege('authenticated','public.gl_record_paid_expense(uuid,text,numeric,timestamptz)','EXECUTE');
SELECT public.business_plan_core_feature_allowed('00000000-0000-4000-8000-000000000000'::uuid,'customers') AS unknown_core_allowed,
 public.business_can_perform_action('00000000-0000-4000-8000-000000000000'::uuid,'customers','create') AS unknown_action_allowed;
