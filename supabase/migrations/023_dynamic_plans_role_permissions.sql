-- 023 | Dynamic subscription plan roles and safely published feature catalogue
-- Prerequisites: migrations 016, 017, 019, and any subsequent installed project migrations.
-- Additive: does not alter prices, assigned plans, plan publication, or earlier migrations.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.public_site_plans') IS NULL
    OR to_regclass('public.platform_plan_features') IS NULL
    OR to_regclass('public.business_plan_assignments') IS NULL
    OR to_regclass('public.business_members') IS NULL THEN
  RAISE EXCEPTION 'Prerequisite schema missing. Do not run migration 023 before 016-019.';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_plan_role_features (
 plan_id text NOT NULL REFERENCES public.public_site_plans(id) ON DELETE CASCADE,
 feature_key text NOT NULL CHECK (feature_key IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team')),
 role public.member_role NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 updated_by uuid REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(plan_id,feature_key,role)
);
ALTER TABLE public.platform_plan_role_features ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_plan_role_features FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_plan_role_features TO authenticated;
DROP POLICY IF EXISTS plan_role_features_admin_read ON public.platform_plan_role_features;
CREATE POLICY plan_role_features_admin_read ON public.platform_plan_role_features FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active=true));

-- Role overrides are optional. When absent, retain the prior access policy.
-- The owner always retains management of modules enabled on their approved plan.
CREATE OR REPLACE FUNCTION public.admin_set_plan_role_feature(
 p_plan_id text,p_feature_key text,p_role text,p_enabled boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
  RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501';
 END IF;
 IF p_feature_key NOT IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team')
    OR p_role NOT IN ('owner','manager','sales','inventory','finance','staff') THEN
  RAISE EXCEPTION 'Invalid module or business role';
 END IF;
 IF p_role='owner' AND NOT p_enabled THEN
  RAISE EXCEPTION 'The business owner must retain access to enabled plan modules';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.public_site_plans WHERE id=p_plan_id) THEN
  RAISE EXCEPTION 'Plan not found';
 END IF;
 INSERT INTO public.platform_plan_role_features(plan_id,feature_key,role,enabled,updated_by)
 VALUES(p_plan_id,p_feature_key,p_role::public.member_role,p_enabled,auth.uid())
 ON CONFLICT(plan_id,feature_key,role) DO UPDATE
 SET enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=now();
END;$$;
REVOKE ALL ON FUNCTION public.admin_set_plan_role_feature(text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_role_feature(text,text,text,boolean) TO authenticated;

-- Save a complete plan permission matrix atomically (one Supabase RPC transaction).
CREATE OR REPLACE FUNCTION public.admin_save_plan_permissions(
 p_plan_id text,p_features jsonb,p_role_features jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_key text;
 v_role text;
 v_enabled boolean;
 v_roles jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
  RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.public_site_plans WHERE id=p_plan_id) THEN
  RAISE EXCEPTION 'Unknown plan';
 END IF;
 IF jsonb_typeof(p_features)<>'object' OR jsonb_typeof(p_role_features)<>'object' THEN
  RAISE EXCEPTION 'Invalid permission payload';
 END IF;
 FOREACH v_key IN ARRAY ARRAY['accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team'] LOOP
  IF p_features->>v_key NOT IN ('true','false') THEN
   RAISE EXCEPTION 'Invalid plan permission: %',v_key;
  END IF;
  v_enabled=(p_features->>v_key)::boolean;
  INSERT INTO public.platform_plan_features(plan_id,feature_key,enabled,updated_by)
  VALUES(p_plan_id,v_key,v_enabled,auth.uid())
  ON CONFLICT(plan_id,feature_key) DO UPDATE
   SET enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=now();
  v_roles=p_role_features->v_key;
  IF jsonb_typeof(v_roles)<>'array' THEN RAISE EXCEPTION 'Invalid role list: %',v_key; END IF;
  FOREACH v_role IN ARRAY ARRAY['manager','finance','sales','inventory','staff'] LOOP
   INSERT INTO public.platform_plan_role_features(plan_id,feature_key,role,enabled,updated_by)
   VALUES(p_plan_id,v_key,v_role::public.member_role,v_roles ? v_role,auth.uid())
   ON CONFLICT(plan_id,feature_key,role) DO UPDATE
    SET enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=now();
  END LOOP;
 END LOOP;
END;$$;
REVOKE ALL ON FUNCTION public.admin_save_plan_permissions(text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_plan_permissions(text,jsonb,jsonb) TO authenticated;

-- Check both the approved plan and current member role at the database level.
-- Unconfigured role overrides fall back to the permissions used by migration 019.
CREATE OR REPLACE FUNCTION public.business_has_feature(p_business_id uuid,p_feature_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_plan text; v_role public.member_role; v_role_override boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 SELECT bm.role INTO v_role FROM public.business_members bm
 WHERE bm.business_id=p_business_id AND bm.user_id=auth.uid();
 IF v_role IS NULL THEN RETURN false; END IF;
 IF p_feature_key IN ('dashboard','customers','orders','payments','expenses','products','settings','upgrade') THEN RETURN true; END IF;
 IF p_feature_key NOT IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team') THEN RETURN false; END IF;
 SELECT a.plan_id INTO v_plan FROM public.business_plan_assignments a WHERE a.business_id=p_business_id;
 IF v_plan IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.platform_plan_features f WHERE f.plan_id=v_plan AND f.feature_key=p_feature_key AND f.enabled
 ) THEN RETURN false; END IF;
 IF v_role='owner' THEN RETURN true; END IF;
 SELECT r.enabled INTO v_role_override FROM public.platform_plan_role_features r
 WHERE r.plan_id=v_plan AND r.feature_key=p_feature_key AND r.role=v_role;
 IF FOUND THEN RETURN v_role_override; END IF;
 RETURN CASE p_feature_key
  WHEN 'accounting' THEN v_role IN ('manager','finance')
  WHEN 'tax' THEN v_role IN ('manager','finance')
  WHEN 'financial_reports' THEN v_role IN ('manager','finance')
  WHEN 'communications' THEN v_role IN ('manager','sales')
  WHEN 'campaigns' THEN v_role='manager'
  WHEN 'inventory' THEN v_role IN ('manager','inventory')
  WHEN 'insights' THEN v_role IN ('manager','finance')
  WHEN 'growth' THEN v_role='manager'
  ELSE false END;
END;$$;
REVOKE ALL ON FUNCTION public.business_has_feature(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_has_feature(uuid,text) TO authenticated;

-- Only published plan/module names are returned to website visitors.
-- Internal role permissions, unlisted plans and business assignments remain private.
CREATE OR REPLACE FUNCTION public.published_plan_features()
RETURNS TABLE(plan_id text,feature_key text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT f.plan_id,f.feature_key FROM public.platform_plan_features f
 JOIN public.public_site_plans p ON p.id=f.plan_id
 WHERE p.published=true AND f.enabled=true
 ORDER BY f.plan_id,f.feature_key;
$$;
REVOKE ALL ON FUNCTION public.published_plan_features() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.published_plan_features() TO anon,authenticated;
COMMIT;
