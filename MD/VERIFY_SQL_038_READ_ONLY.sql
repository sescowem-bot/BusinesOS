-- Read-only migration 038 status. Safe to run repeatedly; does not change data.
SELECT name, to_regclass('public.'||name) IS NOT NULL AS exists
FROM (VALUES('business_purchase_receipts'),('business_purchase_receipt_lines'),('business_supplier_bills'),('business_supplier_bill_payments')) t(name);
SELECT column_name,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='business_purchase_items' AND column_name='received_quantity';
SELECT proname,pg_get_function_identity_arguments(p.oid) AS signature
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('business_receive_purchase_partial','business_record_supplier_bill','business_record_supplier_payment','business_receive_purchase')
ORDER BY proname;
SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('business_purchase_receipts','business_purchase_receipt_lines','business_supplier_bills','business_supplier_bill_payments');
SELECT tablename,policyname,cmd FROM pg_policies WHERE schemaname='public' AND tablename IN ('business_purchase_receipts','business_purchase_receipt_lines','business_supplier_bills','business_supplier_bill_payments') ORDER BY tablename;
