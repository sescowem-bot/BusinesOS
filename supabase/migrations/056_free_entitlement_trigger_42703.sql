-- BusinessOS SQL 056 | Fix inheritance SQLSTATE 42703: NEW.enabled is missing
--
-- Root cause: SQL 044 used NEW.enabled in a boolean AND expression on a trigger
-- shared by platform_plan_features AND plan_parent_links. The plan_parent_links
-- row type has no enabled field. PL/pgSQL record field resolution may occur even
-- when another AND operand is false.
--
-- Safe: changes only the trigger function body. No prices, subscriptions,
-- plan links, data records, payment records, or RLS policies are modified.
-- After a backup, run this migration ONCE in Supabase SQL Editor.
BEGIN;

DO $$
DECLARE v_feature_trigger boolean;
        v_parent_trigger boolean;
BEGIN
 IF to_regclass('public.platform_plan_features') IS NULL
 OR to_regclass('public.plan_parent_links') IS NULL
 OR to_regprocedure('public.prevent_free_entitlement_override()') IS NULL
 THEN RAISE EXCEPTION 'SQL 044 trigger prerequisites missing. Stop and inspect the schema.';
 END IF;

 IF NOT EXISTS(
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='platform_plan_features'
    AND column_name='enabled'
 ) THEN RAISE EXCEPTION 'platform_plan_features.enabled is missing. Stop to inspect the schema.';
 END IF;

 SELECT EXISTS(
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_proc p ON p.oid=t.tgfoid
  JOIN pg_namespace pn ON pn.oid=p.pronamespace
  WHERE n.nspname='public' AND c.relname='platform_plan_features'
    AND t.tgname='keep_free_core_only'
    AND pn.nspname='public' AND p.proname='prevent_free_entitlement_override'
    AND NOT t.tgisinternal
 ) INTO v_feature_trigger;

 SELECT EXISTS(
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_proc p ON p.oid=t.tgfoid
  JOIN pg_namespace pn ON pn.oid=p.pronamespace
  WHERE n.nspname='public' AND c.relname='plan_parent_links'
    AND t.tgname='keep_free_without_parent'
    AND pn.nspname='public' AND p.proname='prevent_free_entitlement_override'
    AND NOT t.tgisinternal
 ) INTO v_parent_trigger;

 IF NOT v_feature_trigger OR NOT v_parent_trigger THEN
  RAISE EXCEPTION 'Expected SQL 044 trigger(s) missing. Stop and inspect current trigger definitions.';
 END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_free_entitlement_override()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
BEGIN
 -- IMPORTANT: Separate branches so enabled is never referenced for plan_parent_links.
 IF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='platform_plan_features' THEN
  IF NEW.plan_id='free' AND NEW.enabled IS TRUE THEN
   RAISE EXCEPTION 'Free is core-only. Grant premium extras to a specific business instead';
  END IF;

 ELSIF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='plan_parent_links' THEN
  IF NEW.plan_id='free' THEN
   RAISE EXCEPTION 'Free must not inherit another plan';
  END IF;

 ELSE
  RAISE EXCEPTION 'Unsupported entitlement validation table: %.%',TG_TABLE_SCHEMA,TG_TABLE_NAME;
 END IF;

 RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_free_entitlement_override()
 FROM PUBLIC,anon,authenticated;

COMMIT;

-- TEST IN THE BUSINESSOS SYSTEM OWNER UI:
-- 1. Set Growth to inherit Starter; click Save plan inheritance.
-- 2. Refresh. Growth should still show Starter as its inherited plan.
-- 3. Ensure Free cannot inherit any plan and cannot have paid modules by default.
-- 4. Check that no paid assignment, customer, or pricing data changed.
--
-- READ-ONLY CONFIRMATION:
-- SELECT plan_id,parent_plan_id FROM public.plan_parent_links ORDER BY plan_id;
