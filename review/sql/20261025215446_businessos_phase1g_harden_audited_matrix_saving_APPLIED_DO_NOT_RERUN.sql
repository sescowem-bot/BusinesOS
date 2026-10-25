-- ALREADY APPLIED TO PRODUCTION (20261025215446)
-- ARCHIVAL COPY. DO NOT REAPPLY.

CREATE OR REPLACE FUNCTION public.admin_save_plan_action_matrix(p_plan_id text, p_role text, p_entries jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE actor uuid:=auth.uid(); v_role public.member_role; item jsonb;
 module_name text; verb text; choice text; seen text[]:=ARRAY[]::text[];
 old_settings jsonb; new_settings jsonb;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=actor AND a.active) THEN
  RAISE EXCEPTION 'System Owner authorization required' USING ERRCODE='42501'; END IF;
 IF p_plan_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id=p_plan_id) THEN
  RAISE EXCEPTION 'Plan unavailable' USING ERRCODE='22023'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('owner','manager','finance','sales','inventory','staff') THEN
  RAISE EXCEPTION 'Invalid role' USING ERRCODE='22023'; END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 300 THEN
  RAISE EXCEPTION 'A clear audit reason of 12-300 characters is required' USING ERRCODE='22023'; END IF;
 IF p_entries IS NULL OR jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries)<>114 THEN
  RAISE EXCEPTION 'A complete 114-action matrix is required' USING ERRCODE='22023'; END IF;
 v_role:=p_role::public.member_role;
 PERFORM 1 FROM public.public_site_plans WHERE id=p_plan_id FOR UPDATE;
 SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY module_key,action_key),'[]'::jsonb)
 INTO old_settings FROM (SELECT module_key,action_key,decision FROM public.platform_plan_action_overrides
  WHERE plan_id=p_plan_id AND role=v_role) z;
 FOR item IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
  IF jsonb_typeof(item)<>'object' THEN RAISE EXCEPTION 'Invalid permission row'; END IF;
  module_name:=item->>'module_key';verb:=item->>'action_key';choice:=item->>'decision';
  IF module_name IS NULL OR module_name NOT IN ('dashboard','customers','orders','payments','products','expenses','documents','settings','pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','campaigns','insights','growth')
    OR verb IS NULL OR verb NOT IN ('view','create','edit','delete','approve','export')
    OR choice IS NULL OR choice NOT IN ('inherit','allow','deny') THEN
    RAISE EXCEPTION 'Unknown action, module or decision' USING ERRCODE='22023'; END IF;
  IF (module_name||':'||verb)=ANY(seen) THEN RAISE EXCEPTION 'Duplicate permission'; END IF;
  seen:=array_append(seen,module_name||':'||verb);
  IF p_plan_id='free' AND module_name NOT IN ('dashboard','customers','orders','payments','products','expenses','documents','settings') AND choice='allow' THEN
    RAISE EXCEPTION 'Free plan cannot explicitly allow premium modules' USING ERRCODE='22023';
  END IF;
  IF p_role='owner' AND module_name='settings' AND verb='view' AND choice='deny' THEN
   RAISE EXCEPTION 'Owner account access cannot be disabled' USING ERRCODE='22023'; END IF;
  -- Preferences never grant a module: the underlying subscription entitlement remains mandatory.
  IF choice='inherit' THEN
   DELETE FROM public.platform_plan_action_overrides WHERE plan_id=p_plan_id AND role=v_role AND module_key=module_name AND action_key=verb;
  ELSE
   INSERT INTO public.platform_plan_action_overrides(plan_id,module_key,role,action_key,decision,updated_by)
   VALUES(p_plan_id,module_name,v_role,verb,choice,actor)
   ON CONFLICT(plan_id,module_key,role,action_key) DO UPDATE SET
   decision=excluded.decision,updated_by=excluded.updated_by,updated_at=now();
  END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY module_key,action_key),'[]'::jsonb)
 INTO new_settings FROM (SELECT module_key,action_key,decision FROM public.platform_plan_action_overrides
  WHERE plan_id=p_plan_id AND role=v_role) z;
 IF old_settings IS DISTINCT FROM new_settings THEN
 INSERT INTO public.platform_plan_action_audit(plan_id,role,reason,previous_values,next_values,changed_by)
 VALUES(p_plan_id,v_role,btrim(p_reason),old_settings,new_settings,actor);END IF;
END;$function$;
