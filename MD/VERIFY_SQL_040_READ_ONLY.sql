-- Read-only Phase 030L installation check. Do not use as a substitute for RLS/concurrency tests.
WITH checks(name,installed) AS (
 VALUES
 ('040 held carts table',to_regclass('public.business_pos_held_carts') IS NOT NULL),
 ('040 split idempotency table',to_regclass('public.business_pos_split_checkouts') IS NOT NULL),
 ('040 held cart save RPC',to_regprocedure('public.business_save_pos_cart(uuid,uuid,text,uuid,uuid,jsonb,text,numeric)') IS NOT NULL),
 ('040 held cart delete RPC',to_regprocedure('public.business_delete_pos_cart(uuid,uuid)') IS NOT NULL),
 ('040 split payment checkout RPC',to_regprocedure('public.business_pos_checkout_split(uuid,uuid,uuid,jsonb,jsonb,text,numeric,uuid)') IS NOT NULL),
 ('040 VAT guard',to_regprocedure('public.business_guard_registered_pos_vat()') IS NOT NULL),
 ('039 location-aware checkout prerequisite',to_regprocedure('public.business_pos_checkout_at_location(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text,text,numeric,uuid)') IS NOT NULL)
)
SELECT name,CASE WHEN installed THEN 'PASS' ELSE 'MISSING' END AS result FROM checks ORDER BY name;

SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 has_table_privilege('authenticated',format('%I.%I',n.nspname,c.relname),'INSERT') AS authenticated_direct_insert,
 has_table_privilege('authenticated',format('%I.%I',n.nspname,c.relname),'UPDATE') AS authenticated_direct_update
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN('business_pos_held_carts','business_pos_split_checkouts') ORDER BY c.relname;

SELECT tgname AS trigger_name,tgenabled AS status FROM pg_trigger
WHERE tgrelid=to_regclass('public.business_pos_sales')
 AND NOT tgisinternal AND tgname='pos_vat_guard_before_sale';
