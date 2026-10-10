-- Read-only diagnostic. Does not change any database record.
SELECT item, present FROM (
 SELECT 'inventory_stock_counts table' AS item, to_regclass('public.inventory_stock_counts') IS NOT NULL AS present
 UNION ALL SELECT 'inventory stock count RPC',to_regprocedure('public.inventory_record_stock_count(uuid,uuid,numeric,numeric,text)') IS NOT NULL
 UNION ALL SELECT 'inventory adjust RPC',to_regprocedure('public.inventory_adjust_stock(uuid,uuid,numeric,text)') IS NOT NULL
 UNION ALL SELECT 'plan-role entitlements',to_regclass('public.platform_plan_role_features') IS NOT NULL
 UNION ALL SELECT 'accounting source queue',to_regclass('public.gl_source_events') IS NOT NULL
 UNION ALL SELECT 'VAT rules',to_regclass('public.tax_rule_versions') IS NOT NULL
) checked ORDER BY item;
SELECT schemaname,tablename,policyname,cmd FROM pg_policies
WHERE schemaname='public' AND tablename='inventory_stock_counts' ORDER BY policyname;
