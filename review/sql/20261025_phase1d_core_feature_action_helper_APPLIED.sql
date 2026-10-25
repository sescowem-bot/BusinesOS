-- Phase 1D: core-module permission is enforced by shared DB action helper, even before action-overrides activate.
CREATE OR REPLACE FUNCTION public.business_can_perform_action(p_business_id uuid, p_module text, p_action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_user uuid := auth.uid();
 v_role public.member_role;
 v_plan text;
 v_parent text;
 v_visited text[] := ARRAY[]::text[];
 v_decision text;
 v_depth integer := 0;
 v_enabled boolean := false;
 v_is_core boolean;
BEGIN
 IF v_user IS NULL OR p_business_id IS NULL THEN RETURN false; END IF;
 IF p_module IS NULL OR p_module NOT IN (
   'dashboard','customers','orders','payments','products','expenses','documents','settings',
   'pos','purchasing','inventory','team','accounting','financial_reports','tax',
   'communications','campaigns','insights','growth')
 OR p_action IS NULL OR p_action NOT IN ('view','create','edit','delete','approve','export')
 THEN RETURN false; END IF;
 IF NOT public.business_membership_is_active(p_business_id,v_user) THEN RETURN false; END IF;
 SELECT role INTO v_role FROM public.business_members
 WHERE business_id=p_business_id AND user_id=v_user;
 IF v_role IS NULL THEN RETURN false; END IF;
 v_is_core := p_module IN (
   'dashboard','customers','orders','payments','products','expenses','documents','settings'
 );
 IF v_is_core AND NOT public.business_plan_core_feature_allowed(p_business_id,p_module) THEN RETURN false; END IF;
 IF NOT v_is_core AND NOT public.business_has_feature(p_business_id,p_module)
 THEN RETURN false; END IF;

 SELECT enabled INTO v_enabled FROM public.platform_plan_action_enforcement WHERE id=true;
 IF v_enabled IS DISTINCT FROM true THEN RETURN true; END IF;

 SELECT plan_id INTO v_plan FROM public.business_plan_assignments
 WHERE business_id=p_business_id AND (expires_at IS NULL OR expires_at>now());
 IF v_plan IS NULL THEN v_plan:='free'; END IF;
 -- The full chain is checked first; missing ancestors and cycles deny rather
 -- than accidentally treating a corrupted plan as unrestricted.
 LOOP
  IF v_plan = ANY(v_visited) OR v_depth>=32 THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id=v_plan) THEN RETURN false; END IF;
  v_visited:=array_append(v_visited,v_plan);
  SELECT parent_plan_id INTO v_parent FROM public.plan_parent_links WHERE plan_id=v_plan;
  EXIT WHEN v_parent IS NULL;
  v_plan:=v_parent;
  v_depth:=v_depth+1;
 END LOOP;

 -- Nearest explicit setting wins. Inherit means retain legacy authorization.
 FOREACH v_plan IN ARRAY v_visited LOOP
  SELECT o.decision INTO v_decision
  FROM public.platform_plan_action_overrides o
  WHERE o.plan_id=v_plan AND o.role=v_role
    AND o.module_key=p_module AND o.action_key=p_action;
  IF FOUND THEN
   IF v_decision='deny' THEN RETURN false; END IF;
   IF v_decision='allow' THEN RETURN true; END IF;
   RETURN false;
  END IF;
 END LOOP;
 RETURN true;
END;$function$;