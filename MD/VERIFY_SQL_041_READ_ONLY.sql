-- Phase 030M: Safe read-only SQL 041 verifier. Run after migration 041, not before.
SELECT 'wholesale reference table' AS object_name,
 to_regclass('public.business_wholesale_price_tiers') IS NOT NULL AS installed
UNION ALL SELECT 'wholesale lookup index',to_regclass('public.wholesale_tier_product_lookup') IS NOT NULL
UNION ALL SELECT 'POS date report index',to_regclass('public.orders_business_created_retail') IS NOT NULL
UNION ALL SELECT 'POS order report index',to_regclass('public.pos_sales_business_order_report') IS NOT NULL
UNION ALL SELECT 'return report index',to_regclass('public.pos_returns_order_report') IS NOT NULL
UNION ALL SELECT 'payments report index',to_regclass('public.pos_payments_business_order_status') IS NOT NULL
UNION ALL SELECT 'order item report index',to_regclass('public.pos_order_items_order_report') IS NOT NULL
UNION ALL SELECT 'set wholesale tier',to_regprocedure('public.business_set_wholesale_price_tier(uuid,uuid,numeric,numeric,text)') IS NOT NULL
UNION ALL SELECT 'delete wholesale tier',to_regprocedure('public.business_delete_wholesale_price_tier(uuid,uuid)') IS NOT NULL
UNION ALL SELECT 'advisory price quote',to_regprocedure('public.business_wholesale_price_quote(uuid,uuid,numeric)') IS NOT NULL
UNION ALL SELECT 'indexed POS management report',to_regprocedure('public.business_pos_management_report(uuid,date,date)') IS NOT NULL;

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_read,
 has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_direct_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_direct_update,
 has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_direct_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='business_wholesale_price_tiers';

SELECT p.proname AS function_name,p.prosecdef AS security_definer,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('business_set_wholesale_price_tier','business_delete_wholesale_price_tier','business_wholesale_price_quote','business_pos_management_report')
ORDER BY p.proname;
