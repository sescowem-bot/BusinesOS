-- SQL 031 read-only diagnostics. Does not create or modify anything.
SELECT 'business_suppliers' AS object, to_regclass('public.business_suppliers') IS NOT NULL AS installed
UNION ALL SELECT 'business_purchase_orders',to_regclass('public.business_purchase_orders') IS NOT NULL
UNION ALL SELECT 'business_purchase_items',to_regclass('public.business_purchase_items') IS NOT NULL
UNION ALL SELECT 'business_pos_sales',to_regclass('public.business_pos_sales') IS NOT NULL;
SELECT c.relname AS table_name,c.relrowsecurity AS row_security_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('business_suppliers','business_purchase_orders','business_purchase_items','business_pos_sales') ORDER BY c.relname;
SELECT proname AS rpc_name,prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('business_create_supplier','business_create_purchase','business_receive_purchase','business_pos_checkout','business_has_feature') ORDER BY proname;
SELECT tablename,policyname,cmd FROM pg_policies WHERE schemaname='public' AND tablename IN ('business_suppliers','business_purchase_orders','business_purchase_items','business_pos_sales') ORDER BY tablename,policyname;
SELECT 'pos' AS feature_key,COUNT(*)::integer AS plan_rows FROM public.platform_plan_features WHERE feature_key='pos'
UNION ALL SELECT 'purchasing',COUNT(*)::integer FROM public.platform_plan_features WHERE feature_key='purchasing';
-- Zero feature rows is expected until the System Owner enables the modules.
