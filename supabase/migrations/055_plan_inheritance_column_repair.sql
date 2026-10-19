-- BusinessOS 055 | Targeted plan-inheritance column and trigger compatibility repair
-- SQLSTATE 42703 indicates an undefined column in an RPC, trigger, or dependent query.
-- Prerequisites: plan migrations 016, 029 and audit migration 053 applied.
-- Does not modify plan prices, current subscription assignments, feature permissions,
-- payment records, or existing parent relationships.
-- Take a database backup. Apply in staging first, then production after review.

BEGIN;

DO $$
DECLARE v_tab regclass:=to_regclass('public.plan_parent_links');
        v_audit regclass:=to_regclass('public.platform_subscription_audit');
        v_missing text;
BEGIN
 IF v_tab IS NULL OR to_regclass('public.public_site_plans') IS NULL
  OR to_regclass('public.platform_admins') IS NULL THEN
  RAISE EXCEPTION 'Required plan tables are missing. Verify migrations 016 and 029 first.';
 END IF;
 IF v_audit IS NULL OR to_regprocedure('public.record_subscription_parent_change()') IS NULL THEN
  RAISE EXCEPTION 'The subscription audit migration 053 is incomplete. Inspect its installation before SQL 055.';
 END IF;
 SELECT string_agg(expected,', ') INTO v_missing FROM (
  SELECT 'plan_id' AS expected UNION ALL SELECT 'parent_plan_id'
 ) required WHERE NOT EXISTS (
  SELECT 1 FROM pg_attribute a WHERE a.attrelid=v_tab AND a.attname=required.expected
   AND a.attnum>0 AND NOT a.attisdropped
 );
 IF v_missing IS NOT NULL THEN
  RAISE EXCEPTION 'plan_parent_links is missing required column(s): %. STOP; inspect migration 029.',v_missing;
 END IF;
 SELECT string_agg(expected,', ') INTO v_missing FROM (
  SELECT unnest(ARRAY['entity_type','entity_key','event_type',
   'previous_value','new_value','actor_id']) AS expected
 ) required WHERE NOT EXISTS (
  SELECT 1 FROM pg_attribute a WHERE a.attrelid=v_audit AND a.attname=required.expected
   AND a.attnum>0 AND NOT a.attisdropped
 );
 IF v_missing IS NOT NULL THEN
  RAISE EXCEPTION 'Subscription audit table missing column(s): %. STOP; inspect migration 053.',v_missing;
 END IF;
END $$;

-- Restore ONLY optional metadata columns expected by original migration 029.
-- Existing values and existing plan-parent assignments are preserved.
ALTER TABLE public.plan_parent_links
 ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.plan_parent_links
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Use the installed table's required columns and no-op when nothing changed.
-- Definer function is still strictly gated by active platform administrator role.
CREATE OR REPLACE FUNCTION public.admin_set_plan_parent(
 p_plan_id text,p_parent_plan_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_current text;v_previous text;v_depth integer:=0;
        v_parent text:=NULLIF(btrim(p_parent_plan_id),'');
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.platform_admins a
  WHERE a.user_id=auth.uid() AND a.active
 ) THEN
  RAISE EXCEPTION 'Platform administrator required' USING ERRCODE='42501';
 END IF;
 IF p_plan_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.public_site_plans WHERE id=p_plan_id
 ) THEN
  RAISE EXCEPTION 'Plan not found' USING ERRCODE='22023';
 END IF;

 -- One transaction at a time may alter the relationship hierarchy.
 LOCK TABLE public.plan_parent_links IN SHARE ROW EXCLUSIVE MODE;
 SELECT parent_plan_id INTO v_previous
 FROM public.plan_parent_links WHERE plan_id=p_plan_id;

 IF v_parent IS NULL THEN
  IF v_previous IS NOT NULL THEN
   DELETE FROM public.plan_parent_links WHERE plan_id=p_plan_id;
  END IF;
  RETURN;
 END IF;
 IF v_parent=p_plan_id OR NOT EXISTS (
  SELECT 1 FROM public.public_site_plans WHERE id=v_parent
 ) THEN
  RAISE EXCEPTION 'Invalid parent plan' USING ERRCODE='22023';
 END IF;
 IF v_previous IS NOT DISTINCT FROM v_parent THEN RETURN; END IF;

 v_current:=v_parent;
 WHILE v_current IS NOT NULL LOOP
  IF v_current=p_plan_id THEN
   RAISE EXCEPTION 'Circular plan inheritance is not permitted' USING ERRCODE='22023';
  END IF;
  v_depth:=v_depth+1;
  IF v_depth>32 THEN
   RAISE EXCEPTION 'Plan hierarchy exceeds 32 levels' USING ERRCODE='22023';
  END IF;
  SELECT parent_plan_id INTO v_current
  FROM public.plan_parent_links WHERE plan_id=v_current;
 END LOOP;

 INSERT INTO public.plan_parent_links(plan_id,parent_plan_id,updated_by,updated_at)
 VALUES(p_plan_id,v_parent,auth.uid(),now())
 ON CONFLICT(plan_id) DO UPDATE
 SET parent_plan_id=EXCLUDED.parent_plan_id,
     updated_by=EXCLUDED.updated_by,updated_at=now();
END;$$;

REVOKE ALL ON FUNCTION public.admin_set_plan_parent(text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_parent(text,text) TO authenticated;

-- Restore the audit trigger body without changing or duplicating its trigger.
-- JSON conversion avoids brittle OLD/NEW.field access when database versions drift.
CREATE OR REPLACE FUNCTION public.record_subscription_parent_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_before jsonb;v_after jsonb;v_key text;
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN v_before:=to_jsonb(OLD);END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN v_after:=to_jsonb(NEW);END IF;
 v_key:=COALESCE(v_after->>'plan_id',v_before->>'plan_id');

 IF TG_OP='UPDATE' AND
   (v_before->>'parent_plan_id') IS NOT DISTINCT FROM (v_after->>'parent_plan_id')
 THEN RETURN NEW;END IF;

 INSERT INTO public.platform_subscription_audit
 (entity_type,entity_key,event_type,previous_value,new_value,actor_id)
 VALUES(
  'inheritance',v_key,
  CASE WHEN TG_OP='INSERT' THEN 'created'
       WHEN TG_OP='DELETE' THEN 'removed' ELSE 'changed' END,
  CASE WHEN v_before IS NULL THEN NULL ELSE jsonb_build_object('parent',v_before->>'parent_plan_id') END,
  CASE WHEN v_after IS NULL THEN NULL ELSE jsonb_build_object('parent',v_after->>'parent_plan_id') END,
  auth.uid()
 );
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END;$$;

REVOKE ALL ON FUNCTION public.record_subscription_parent_change()
 FROM PUBLIC,anon,authenticated;

COMMIT;

-- AFTER INSTALL: refresh the browser, choose a DIFFERENT parent, then save.
-- Verify no unintended changes with this read-only query:
-- SELECT plan_id,parent_plan_id,updated_at FROM public.plan_parent_links ORDER BY plan_id;
-- If error 42703 remains, copy the full PostgreSQL error.message and details
-- from the System Owner screen or Vercel function log; another trigger is likely involved.
