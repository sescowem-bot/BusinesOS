-- BusinessOS Phase 030F migration 032 read-only checks.
SELECT table_name, rowsecurity AS rls_enabled
FROM pg_tables WHERE schemaname='public' AND tablename IN ('business_invoice_profiles','business_order_tax_reviews')
ORDER BY tablename;
SELECT p.proname AS function_name,pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('crm_create_tax_reviewed_order','attach_reviewed_tax_invoice_snapshot');
SELECT trigger_name,event_object_table,action_timing,event_manipulation
FROM information_schema.triggers
WHERE event_object_schema='public' AND trigger_name='invoice_tax_identity_at_issue';
SELECT tablename,policyname,cmd,roles,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN ('business_invoice_profiles','business_order_tax_reviews');
-- View only the first 10 approved VAT rules (not business data):
SELECT id,rule_code,treatment,rate_basis_points,effective_from,effective_to,status
FROM public.tax_rule_versions WHERE tax_kind='vat' AND status='approved'
ORDER BY effective_from DESC LIMIT 10;
