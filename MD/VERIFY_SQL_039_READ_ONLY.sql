-- BusinessOS Migration 039 read-only verification. Runs in Supabase SQL Editor; no INSERT/UPDATE/DELETE.
SELECT 'stock locations' AS object_name,to_regclass('public.business_stock_locations') IS NOT NULL AS exists;
SELECT 'location balances' AS object_name,to_regclass('public.business_location_balances') IS NOT NULL AS exists;
SELECT 'stock transfers' AS object_name,to_regclass('public.business_location_stock_transfers') IS NOT NULL AS exists;
SELECT 'location counts' AS object_name,to_regclass('public.business_location_stock_counts') IS NOT NULL AS exists;
SELECT p.proname AS function_name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('business_sync_location_balance','business_enable_branch_stock','business_transfer_location_stock',
 'business_count_location_stock','business_pos_checkout_at_location','business_guard_legacy_aggregate_stock_count')
 ORDER BY p.proname;
SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public'
 AND tablename IN ('business_stock_locations','business_location_balances','business_location_stock_transfers','business_location_stock_counts');
-- Run the next two SELECT statements only after the tables above exist.
SELECT p.business_id,p.id AS product_id,p.name,p.stock_quantity AS company_stock,
 coalesce(sum(lb.quantity),0) AS allocated_total,
 p.stock_quantity-coalesce(sum(lb.quantity),0) AS discrepancy
FROM public.products p LEFT JOIN public.business_location_balances lb
 ON lb.business_id=p.business_id AND lb.product_id=p.id
WHERE p.track_inventory
GROUP BY p.business_id,p.id,p.name,p.stock_quantity
HAVING abs(p.stock_quantity-coalesce(sum(lb.quantity),0))>0.0001
ORDER BY p.business_id,p.name LIMIT 100;
SELECT l.business_id,l.name,l.branch_id,l.is_unallocated,count(b.product_id) AS tracked_items,
 coalesce(sum(b.quantity),0) AS total_item_units
FROM public.business_stock_locations l LEFT JOIN public.business_location_balances b
 ON b.business_id=l.business_id AND b.location_id=l.id
GROUP BY l.business_id,l.id,l.name,l.branch_id,l.is_unallocated
ORDER BY l.business_id,l.is_unallocated DESC,l.name LIMIT 100;
