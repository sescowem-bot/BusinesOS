-- Read-only migration 033 verifier: never creates or modifies data.
SELECT item, installed FROM (
 VALUES
  ('business_product_tax_mappings table',to_regclass('public.business_product_tax_mappings') IS NOT NULL),
  ('business_pos_tax_lines table',to_regclass('public.business_pos_tax_lines') IS NOT NULL),
  ('product tax mapping function',to_regprocedure('public.business_set_product_tax_mapping(uuid,uuid,uuid)') IS NOT NULL),
  ('reviewed POS checkout function',to_regprocedure('public.business_pos_checkout_reviewed(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text)') IS NOT NULL),
  ('existing POS checkout protected',to_regprocedure('public.business_pos_checkout(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text)') IS NOT NULL),
  ('invoice VAT snapshot trigger',EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.business_invoices'::regclass AND tgname='invoice_pos_tax_details_at_issue' AND NOT tgisinternal))
) AS checks(item,installed);

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('business_product_tax_mappings','business_pos_tax_lines');

SELECT schemaname,tablename,policyname,cmd,roles FROM pg_policies
WHERE schemaname='public' AND tablename IN ('business_product_tax_mappings','business_pos_tax_lines');

SELECT proname,prosecdef AS security_definer FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace
WHERE n.nspname='public' AND proname IN ('business_pos_checkout','business_pos_checkout_reviewed','business_set_product_tax_mapping');
