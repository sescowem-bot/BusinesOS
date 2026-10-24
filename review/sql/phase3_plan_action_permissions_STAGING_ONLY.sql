-- STAGING REVIEW ONLY. Do not execute against the production BusinessOS database.
-- This additive design stores audited, per-plan/per-role/per-action preferences.
-- Preferences have NO effect on current business access until EVERY relevant
-- API/RPC/RLS path is tested and the separate enforcement release is approved.
BEGIN;
CREATE TABLE public.platform_plan_action_overrides(
 plan_id text NOT NULL REFERENCES public.public_site_plans(id) ON DELETE CASCADE,
 module_key text NOT NULL CHECK(module_key IN (
 'dashboard','customers','orders','payments','products','expenses','documents','settings',
 'pos','purchasing','inventory','team','accounting','financial_reports','tax',
 'communications','campaigns','insights','growth')),
 role public.member_role NOT NULL,
 action_key text NOT NULL CHECK(action_key IN ('view','create','edit','delete','approve','export')),
 decision text NOT NULL CHECK(decision IN ('allow','deny')),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(plan_id,module_key,role,action_key)
);
CREATE TABLE public.platform_plan_action_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 plan_id text NOT NULL,
 role public.member_role NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 12 AND 300),
 previous_values jsonb NOT NULL,
 next_values jsonb NOT NULL,
 changed_by uuid NOT NULL REFERENCES auth.users(id),
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_plan_action_audit_latest ON public.platform_plan_action_audit(plan_id,changed_at DESC);
ALTER TABLE public.platform_plan_action_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_plan_action_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_plan_action_overrides,public.platform_plan_action_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_plan_action_overrides,public.platform_plan_action_audit TO authenticated;
CREATE POLICY platform_owner_read_action_overrides ON public.platform_plan_action_overrides
 FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY platform_owner_read_action_audit ON public.platform_plan_action_audit
 FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));
-- SECURITY DEFINER needed only for the audited, non-exposed write path.
-- Authorization is checked against platform_admins in the database.
CREATE FUNCTION public.admin_save_plan_action_matrix(p_plan_id text,p_role text,p_entries jsonb,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_actor uuid:=auth.uid();
 v_role public.member_role;
 v_entry jsonb;
 v_module text;
 v_action text;
 v_decision text;
 v_seen text[]:=ARRAY[]::text[];
 v_before jsonb;
 v_after jsonb;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=v_actor AND a.active)
 THEN RAISE EXCEPTION 'System Owner authorization required' USING ERRCODE='42501'; END IF;
 IF p_plan_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id=p_plan_id)
 THEN RAISE EXCEPTION 'Unknown plan' USING ERRCODE='22023'; END IF;
 IF p_role NOT IN ('owner','manager','finance','sales','inventory','staff')
 THEN RAISE EXCEPTION 'Invalid staff role' USING ERRCODE='22023'; END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 300 THEN
 RAISE EXCEPTION 'An audit reason of 12–300 characters is required' USING ERRCODE='22023'; END IF;
 IF p_entries IS NULL OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Permission matrix must be an array' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_entries)<>114 THEN
 RAISE EXCEPTION 'The permission matrix must contain all module actions' USING ERRCODE='22023'; END IF;
 v_role:=p_role::public.member_role;
 PERFORM 1 FROM public.public_site_plans WHERE id=p_plan_id FOR UPDATE;
 SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY module_key,action_key),'[]'::jsonb) INTO v_before
  FROM (SELECT module_key,action_key,decision FROM public.platform_plan_action_overrides
   WHERE plan_id=p_plan_id AND role=v_role) o;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_entries)
 LOOP
  IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Invalid permission row' USING ERRCODE='22023'; END IF;
  v_module:=v_entry->>'module_key';
  v_action:=v_entry->>'action_key';
  v_decision:=v_entry->>'decision';
  IF v_module IS NULL OR v_module NOT IN
   ('dashboard','customers','orders','payments','products','expenses','documents','settings',
   'pos','purchasing','inventory','team','accounting','financial_reports','tax',
   'communications','campaigns','insights','growth')
   OR v_action IS NULL OR v_action NOT IN ('view','create','edit','delete','approve','export')
   OR v_decision IS NULL OR v_decision NOT IN ('inherit','allow','deny')
  THEN RAISE EXCEPTION 'Unrecognized action or module' USING ERRCODE='22023'; END IF;
  IF (v_module||':'||v_action)=ANY(v_seen)
  THEN RAISE EXCEPTION 'Duplicate action setting' USING ERRCODE='22023'; END IF;
  v_seen:=array_append(v_seen,v_module||':'||v_action);
  IF p_plan_id='free' AND v_module NOT IN
   ('dashboard','customers','orders','payments','products','expenses','documents','settings') AND v_decision='allow'
  THEN RAISE EXCEPTION 'Free may not grant premium module actions' USING ERRCODE='22023'; END IF;
  IF p_role='owner' AND v_module='settings' AND v_action='view' AND v_decision='deny'
  THEN RAISE EXCEPTION 'Owner must retain view access to settings' USING ERRCODE='22023'; END IF;
  IF v_decision='inherit' THEN
    DELETE FROM public.platform_plan_action_overrides
     WHERE plan_id=p_plan_id AND role=v_role AND module_key=v_module AND action_key=v_action;
  ELSE
    INSERT INTO public.platform_plan_action_overrides(plan_id,module_key,role,action_key,decision,updated_by,updated_at)
    VALUES(p_plan_id,v_module,v_role,v_action,v_decision,v_actor,now())
    ON CONFLICT (plan_id,module_key,role,action_key)
    DO UPDATE SET decision=excluded.decision,updated_by=excluded.updated_by,updated_at=excluded.updated_at
    WHERE platform_plan_action_overrides.decision IS DISTINCT FROM excluded.decision;
  END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY module_key,action_key),'[]'::jsonb) INTO v_after
 FROM (SELECT module_key,action_key,decision FROM public.platform_plan_action_overrides
 WHERE plan_id=p_plan_id AND role=v_role) o;
 IF v_before IS DISTINCT FROM v_after THEN
  INSERT INTO public.platform_plan_action_audit(plan_id,role,reason,previous_values,next_values,changed_by)
  VALUES(p_plan_id,v_role,btrim(p_reason),v_before,v_after,v_actor);
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_save_plan_action_matrix(text,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_plan_action_matrix(text,text,jsonb,text) TO authenticated;
COMMIT;
