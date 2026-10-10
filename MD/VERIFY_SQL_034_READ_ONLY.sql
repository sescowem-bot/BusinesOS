-- READ ONLY: Run after applying SQL 034, preferably in staging.
-- No tables, permissions, records, or invoice totals are modified.
SELECT 'business_pos_pricing_contexts table' AS check_name,
       to_regclass('public.business_pos_pricing_contexts') IS NOT NULL AS installed
UNION ALL
SELECT 'priced checkout RPC',to_regprocedure('public.business_pos_checkout_priced(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text,text,numeric)') IS NOT NULL
UNION ALL
SELECT 'invoice pricing snapshot function',to_regprocedure('public.attach_pos_pricing_invoice_snapshot()') IS NOT NULL
UNION ALL
SELECT 'new invoice trigger',EXISTS (
 SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='business_invoices'
 AND t.tgname='invoice_pos_pricing_at_issue' AND NOT t.tgisinternal)
UNION ALL
SELECT 'pricing context RLS enabled',EXISTS (
 SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='business_pos_pricing_contexts' AND c.relrowsecurity)
UNION ALL
SELECT 'pricing context read policy',EXISTS (
 SELECT 1 FROM pg_policies WHERE schemaname='public'
 AND tablename='business_pos_pricing_contexts' AND policyname='pos_pricing_read');

-- Existing ledger/invoice row counts are useful for verifying non-destructive migration.
SELECT 'issued invoices' AS dataset,COUNT(*) AS rows FROM public.business_invoices
UNION ALL SELECT 'POS sales',COUNT(*) FROM public.business_pos_sales;
