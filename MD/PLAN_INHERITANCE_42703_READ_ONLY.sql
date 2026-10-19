-- BusinessOS plan inheritance (SQLSTATE 42703) — READ ONLY diagnostic.
-- Run in Supabase SQL Editor, and share the two result tables.
-- 1. Confirm actual columns used by the relationship RPC and audit trigger.
SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
 AND table_name IN ('plan_parent_links','platform_subscription_audit','public_site_plans','platform_admins')
 AND (
  (table_name='plan_parent_links' AND column_name IN ('plan_id','parent_plan_id','updated_by','updated_at'))
  OR (table_name='platform_subscription_audit' AND column_name IN ('entity_type','entity_key','event_type','previous_value','new_value','actor_id'))
  OR (table_name='public_site_plans' AND column_name IN ('id','published'))
  OR (table_name='platform_admins' AND column_name IN ('user_id','active'))
 )
ORDER BY table_name,column_name;

-- 2. Show active triggers on the plan inheritance table.
SELECT t.tgname AS trigger_name,
       p.proname AS function_name,
       pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname='public' AND c.relname='plan_parent_links'
 AND NOT t.tgisinternal
ORDER BY trigger_name;

-- 3. Check whether the function has the expected signature.
SELECT to_regprocedure('public.admin_set_plan_parent(text,text)') AS inheritance_rpc,
       to_regprocedure('public.record_subscription_parent_change()') AS audit_trigger_function;

-- 4. (Optional) If 1–3 are inconclusive, inspect the ACTUAL deployed function:
-- SELECT pg_get_functiondef('public.admin_set_plan_parent(text,text)'::regprocedure);
-- SELECT pg_get_functiondef('public.record_subscription_parent_change()'::regprocedure);
