-- BusinessOS SQL 042: read-only checklist. Run after applying SQL 042 on staging.
-- This script makes NO INSERT, UPDATE, DELETE, CREATE or permission changes.
SELECT name AS required_table,to_regclass('public.'||name) IS NOT NULL AS installed
FROM (VALUES('business_support_requests'),('business_member_role_audit'),('business_order_cost_evidence')) t(name);

SELECT p.proname AS function_name,p.prosecdef AS security_definer,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
('business_dashboard_command','crm_create_order_with_cost','business_record_missing_order_cost',
 'business_open_support_request','business_update_team_role','platform_support_queue',
 'platform_resolve_support_request') ORDER BY p.proname;

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
  has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_can_select,
  has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_can_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_can_update,
  has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
('business_support_requests','business_member_role_audit','business_order_cost_evidence')
ORDER BY c.relname;

SELECT tablename,policyname,cmd FROM pg_policies WHERE schemaname='public'
 AND tablename IN('business_support_requests','business_member_role_audit','business_order_cost_evidence') ORDER BY tablename;

-- Existing order, payment and invoice totals must be verified before/after migration.
SELECT 'orders' AS dataset,COUNT(*) AS rows FROM public.orders
UNION ALL SELECT 'payments',COUNT(*) FROM public.payments
UNION ALL SELECT 'issued_invoices',COUNT(*) FROM public.business_invoices;
