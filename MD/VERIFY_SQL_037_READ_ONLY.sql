-- BusinessOS Phase 030J read-only diagnostics. Safe to run without changes.
-- Do not run migration 037 twice. This query does not activate features.
WITH required_tables(name) AS (
 VALUES ('business_pos_cashier_shifts'),('business_pos_shift_receipts'),('business_pos_cash_movements')
), check_tables AS (
 SELECT name,to_regclass('public.'||name) IS NOT NULL AS installed,
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid=to_regclass('public.'||name)) AS rls_enabled
 FROM required_tables
), required_functions(name) AS (
 VALUES ('business_open_pos_shift'),('business_add_pos_cash_movement'),
 ('business_close_pos_shift'),('business_review_pos_shift'),('business_pos_shift_totals'),
 ('business_pos_cash_exceptions'),('business_pos_daily_cash_report'),
 ('pos_attach_active_shift'),('pos_attach_checkout_cash'),('pos_capture_later_cash')
), check_functions AS (
 SELECT name,EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname=name) AS installed FROM required_functions
), checks AS (
 SELECT 'table' AS object_type,name,installed,coalesce(rls_enabled,false) AS rls_enabled FROM check_tables
 UNION ALL SELECT 'function',name,installed,NULL::boolean FROM check_functions
 UNION ALL SELECT 'POS shift foreign key','business_pos_sales.shift_id',EXISTS(
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_pos_sales' AND column_name='shift_id'),NULL::boolean
 UNION ALL SELECT 'unique active shift index','cashier_one_active_shift',EXISTS(
  SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='cashier_one_active_shift'),NULL::boolean
)
SELECT * FROM checks ORDER BY object_type,name;
