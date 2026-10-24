-- HISTORICAL COPY: APPLIED IN PRODUCTION ON 2026-10-24 VIA SUPABASE. DO NOT RE-RUN.
-- BusinessOS: one-copy-paste SQL — SAFE MANAGEMENT FOUNDATION for existing production database.
-- This SQL intentionally DOES NOT claim the 7-item accounting correction is done.
-- Run ONCE after making a database backup. No other SQL from older review archives is required for this installation.
-- It creates role permissions, quota settings, trial preferences and audit evidence; the quota and action
-- enforcement toggles remain FALSE to prevent unverified production blocks.
-- Customer orders, sales, payments, invoices, credentials, current plans and legal publications are preserved.
BEGIN;
DO $precheck$
BEGIN
 IF to_regclass('public.platform_plan_action_overrides') IS NOT NULL OR
    to_regclass('public.platform_plan_usage_limits') IS NOT NULL OR
    to_regclass('public.platform_plan_action_enforcement') IS NOT NULL OR
    to_regclass('public.platform_usage_enforcement') IS NOT NULL THEN
    RAISE EXCEPTION 'Some foundation tables already exist. Stop and reconcile; do not rerun this file.';
 END IF;
 IF to_regclass('public.public_site_plans') IS NULL OR to_regclass('public.platform_admins') IS NULL
    OR to_regclass('public.platform_plan_role_features') IS NULL OR to_regclass('public.plan_parent_links') IS NULL THEN
    RAISE EXCEPTION 'Required existing BusinessOS schema missing';
 END IF;
END;$precheck$;

-- 1. ACTION MATRIX (audit, RLS; switch disabled)

CREATE TABLE public.platform_plan_action_overrides(
 plan_id text NOT NULL REFERENCES public.public_site_plans(id),
 module_key text NOT NULL CHECK(module_key IN ('dashboard','customers','orders','payments','products','expenses','documents','settings','pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','campaigns','insights','growth')),
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
CREATE TABLE public.platform_plan_action_enforcement(
 id boolean PRIMARY KEY DEFAULT true CHECK (id=true),
 enabled boolean NOT NULL DEFAULT false,
 changed_at timestamptz,
 reason text NOT NULL DEFAULT 'Disabled until all server actions, writer RPCs and RLS have been verified'
);
INSERT INTO public.platform_plan_action_enforcement(id,enabled) VALUES(true,false);
ALTER TABLE public.platform_plan_action_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_plan_action_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_plan_action_enforcement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_plan_action_overrides,public.platform_plan_action_audit,public.platform_plan_action_enforcement FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_plan_action_overrides,public.platform_plan_action_audit,public.platform_plan_action_enforcement TO authenticated;
CREATE POLICY owner_read_action_rules ON public.platform_plan_action_overrides FOR SELECT TO authenticated USING
 (EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY owner_read_action_audit ON public.platform_plan_action_audit FOR SELECT TO authenticated USING
 (EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY owner_read_action_switch ON public.platform_plan_action_enforcement FOR SELECT TO authenticated USING
 (EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));
CREATE FUNCTION public.admin_save_plan_action_matrix(p_plan_id text,p_role text,p_entries jsonb,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
END;$$;
REVOKE ALL ON FUNCTION public.admin_save_plan_action_matrix(text,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_plan_action_matrix(text,text,jsonb,text) TO authenticated;

-- 2. ACTION CHECKER REFERENCE (requires existing membership/feature RPCs)
CREATE FUNCTION public.business_can_perform_action(
 p_business_id uuid,p_module text,p_action text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
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
END;$$;
REVOKE ALL ON FUNCTION public.business_can_perform_action(uuid,text,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_can_perform_action(uuid,text,text)
 TO authenticated;

-- 3. NUMERICAL LIMITS (audit, system owner RPC; disabled insert guards)

DO $$ BEGIN
 IF to_regclass('public.platform_plan_usage_limits') IS NOT NULL
 OR to_regclass('public.platform_usage_enforcement') IS NOT NULL THEN
   RAISE EXCEPTION 'Usage schema already installed; reconcile instead of replaying';
 END IF;
 IF to_regclass('public.public_site_plans') IS NULL OR to_regclass('public.businesses') IS NULL THEN
   RAISE EXCEPTION 'Missing prerequisite BusinessOS schema'; END IF;
END $$;
CREATE TABLE public.platform_plan_usage_limits(
 plan_id text NOT NULL REFERENCES public.public_site_plans(id),
 metric_key text NOT NULL CHECK(metric_key IN ('customers','products','team_members','branches','orders_monthly')),
 max_count bigint NOT NULL CHECK(max_count>=0 AND max_count<=1000000000),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(plan_id,metric_key)
);
CREATE TABLE public.platform_usage_enforcement(
 id boolean PRIMARY KEY DEFAULT true CHECK(id=true),
 enabled boolean NOT NULL DEFAULT false,
 reviewed_at timestamptz,
 reason text NOT NULL DEFAULT 'Disabled pending integration and concurrency tests'
);
INSERT INTO public.platform_usage_enforcement(id,enabled) VALUES(true,false);
CREATE TABLE public.platform_usage_limit_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 plan_id text NOT NULL,
 metric_key text NOT NULL,
 old_cap bigint,
 new_cap bigint,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 12 AND 300),
 actor uuid NOT NULL REFERENCES auth.users(id),
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_plan_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_usage_enforcement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_usage_limit_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_plan_usage_limits,public.platform_usage_enforcement,public.platform_usage_limit_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_plan_usage_limits,public.platform_usage_enforcement,public.platform_usage_limit_audit TO authenticated;
CREATE POLICY quota_admin_read_caps ON public.platform_plan_usage_limits FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY quota_admin_read_switch ON public.platform_usage_enforcement FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY quota_admin_read_audit ON public.platform_usage_limit_audit FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));

CREATE FUNCTION public.admin_set_plan_quota(p_plan text,p_metric text,p_max bigint,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old_cap bigint; v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=v_actor AND a.active)
 THEN RAISE EXCEPTION 'System Owner authorization required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id=p_plan) OR
 p_metric NOT IN ('customers','products','team_members','branches','orders_monthly') OR
 p_max IS NULL OR p_max<0 OR p_max>1000000000 OR
 length(trim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 300
 THEN RAISE EXCEPTION 'Invalid plan quota or audit reason' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.public_site_plans WHERE id=p_plan FOR UPDATE;
 SELECT max_count INTO old_cap FROM public.platform_plan_usage_limits
 WHERE plan_id=p_plan AND metric_key=p_metric;
 IF old_cap IS NOT DISTINCT FROM p_max THEN RETURN; END IF;
 INSERT INTO public.platform_plan_usage_limits(plan_id,metric_key,max_count,updated_by)
 VALUES(p_plan,p_metric,p_max,v_actor)
 ON CONFLICT(plan_id,metric_key) DO UPDATE SET max_count=excluded.max_count,
 updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO public.platform_usage_limit_audit(plan_id,metric_key,old_cap,new_cap,reason,actor)
 VALUES(p_plan,p_metric,old_cap,p_max,trim(p_reason),v_actor);
END $$;
REVOKE ALL ON FUNCTION public.admin_set_plan_quota(text,text,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_quota(text,text,bigint,text) TO authenticated;

CREATE FUNCTION public.businessos_check_quota_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_enabled boolean;v_metric text;v_plan text;v_parent text;
 v_visited text[]:=ARRAY[]::text[]; v_count bigint; v_limit bigint;
 v_start timestamptz;v_end timestamptz;v_depth int:=0;
BEGIN
 SELECT enabled INTO v_enabled FROM public.platform_usage_enforcement WHERE id=true;
 IF v_enabled IS DISTINCT FROM true THEN RETURN NEW; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Usage enforcement requires READ COMMITTED isolation' USING ERRCODE='P0001'; END IF;
 v_metric:=CASE TG_TABLE_NAME WHEN 'business_customers' THEN 'customers'
 WHEN 'products' THEN 'products' WHEN 'business_members' THEN 'team_members'
 WHEN 'business_branches' THEN 'branches' WHEN 'orders' THEN 'orders_monthly' ELSE null END;
 IF v_metric IS NULL OR NEW.business_id IS NULL THEN
   RAISE EXCEPTION 'Unrecognized quota operation' USING ERRCODE='P0001'; END IF;
 -- Serialize all create attempts of one business in one transaction. After lock
 -- acquisition the subsequent count sees the preceding committed insertion.
 PERFORM 1 FROM public.businesses WHERE id=NEW.business_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No matching business' USING ERRCODE='42501'; END IF;
 SELECT plan_id INTO v_plan FROM public.business_plan_assignments
 WHERE business_id=NEW.business_id AND (expires_at IS NULL OR expires_at>now());
 v_plan:=coalesce(v_plan,'free');
 LOOP
   IF v_plan=ANY(v_visited) OR v_depth>=32 OR
      NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id=v_plan) THEN
      RAISE EXCEPTION 'Usage plan inheritance invalid' USING ERRCODE='P0001'; END IF;
   v_visited:=array_append(v_visited,v_plan);
   SELECT max_count INTO v_limit FROM public.platform_plan_usage_limits
   WHERE plan_id=v_plan AND metric_key=v_metric;
   EXIT WHEN FOUND;
   SELECT parent_plan_id INTO v_parent FROM public.plan_parent_links WHERE plan_id=v_plan;
   IF v_parent IS NULL THEN RAISE EXCEPTION 'Usage cap missing for active metric' USING ERRCODE='P0001'; END IF;
   v_plan:=v_parent;v_depth:=v_depth+1;
 END LOOP;
 IF v_metric='customers' THEN SELECT count(*) INTO v_count FROM public.business_customers WHERE business_id=NEW.business_id;
 ELSIF v_metric='products' THEN SELECT count(*) INTO v_count FROM public.products WHERE business_id=NEW.business_id;
 ELSIF v_metric='team_members' THEN SELECT count(*) INTO v_count FROM public.business_members WHERE business_id=NEW.business_id;
 ELSIF v_metric='branches' THEN SELECT count(*) INTO v_count FROM public.business_branches WHERE business_id=NEW.business_id;
 ELSE
   v_start:=(date_trunc('month',now() AT TIME ZONE 'Africa/Lagos')) AT TIME ZONE 'Africa/Lagos';
   v_end:=((date_trunc('month',now() AT TIME ZONE 'Africa/Lagos')+interval '1 month')) AT TIME ZONE 'Africa/Lagos';
   IF NEW.created_at IS NULL OR NEW.created_at<v_start OR NEW.created_at>=v_end THEN
      RAISE EXCEPTION 'BUSINESS_USAGE_IMPORT_DATE_REVIEW_REQUIRED' USING ERRCODE='P0001'; END IF;
   SELECT count(*) INTO v_count FROM public.orders WHERE business_id=NEW.business_id AND created_at>=v_start AND created_at<v_end;
 END IF;
 IF v_count>=v_limit THEN
   RAISE EXCEPTION 'BUSINESS_USAGE_LIMIT_REACHED: %',v_metric USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.businessos_check_quota_before_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER businessos_quota_customers BEFORE INSERT ON public.business_customers FOR EACH ROW EXECUTE FUNCTION public.businessos_check_quota_before_insert();
CREATE TRIGGER businessos_quota_products BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.businessos_check_quota_before_insert();
CREATE TRIGGER businessos_quota_members BEFORE INSERT ON public.business_members FOR EACH ROW EXECUTE FUNCTION public.businessos_check_quota_before_insert();
CREATE TRIGGER businessos_quota_branches BEFORE INSERT ON public.business_branches FOR EACH ROW EXECUTE FUNCTION public.businessos_check_quota_before_insert();
CREATE TRIGGER businessos_quota_orders BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.businessos_check_quota_before_insert();
-- Still DISABLED! Do NOT set enabled=true before staging parity and concurrency tests.

-- 4. SYSTEM OWNER TRIAL CONFIGURATION (not a customer trial engine)

CREATE TABLE public.platform_plan_trial_settings(
 plan_id text PRIMARY KEY REFERENCES public.public_site_plans(id),
 trial_days int NOT NULL DEFAULT 0 CHECK(trial_days BETWEEN 0 AND 30),
 enabled boolean NOT NULL DEFAULT false,
 updated_by uuid REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_plan_trial_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_plan_trial_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_plan_trial_settings TO authenticated;
CREATE POLICY owner_view_trial_options ON public.platform_plan_trial_settings
 FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=(SELECT auth.uid()) AND active));
INSERT INTO public.platform_plan_trial_settings(plan_id,trial_days,enabled)
SELECT id,0,false FROM public.public_site_plans ON CONFLICT(plan_id) DO NOTHING;
CREATE FUNCTION public.admin_set_plan_trial(p_plan text,p_days integer,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid();BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=actor AND active)
 THEN RAISE EXCEPTION 'System Owner authorization required' USING ERRCODE='42501';END IF;
 IF p_days IS NULL OR p_days<0 OR p_days>30 OR p_enabled IS NULL THEN
 RAISE EXCEPTION 'Trial must be between zero and 30 days' USING ERRCODE='22023'; END IF;
 INSERT INTO public.platform_plan_trial_settings(plan_id,trial_days,enabled,updated_by)
 VALUES(p_plan,p_days,p_enabled,actor) ON CONFLICT(plan_id) DO UPDATE SET
 trial_days=excluded.trial_days,enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
END;$$;
REVOKE ALL ON FUNCTION public.admin_set_plan_trial(text,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_trial(text,integer,boolean) TO authenticated;

-- 5. DORMANT FREE PREMIUM ROLE PREFERENCES (audited, reversible)

CREATE TABLE public.platform_free_role_cleanup_evidence(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 plan_id text NOT NULL,feature_key text NOT NULL,role public.member_role NOT NULL,
 old_enabled boolean NOT NULL, original_updated_at timestamptz,
 changed_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL DEFAULT 'Dormant premium role preference without plan entitlement'
);
ALTER TABLE public.platform_free_role_cleanup_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_free_role_cleanup_evidence FROM PUBLIC,anon,authenticated;
INSERT INTO public.platform_free_role_cleanup_evidence(plan_id,feature_key,role,old_enabled,original_updated_at)
SELECT r.plan_id,r.feature_key,r.role,r.enabled,r.updated_at FROM public.platform_plan_role_features r
WHERE r.plan_id='free' AND r.enabled
AND NOT EXISTS(SELECT 1 FROM public.platform_plan_features f WHERE f.plan_id='free' AND f.feature_key=r.feature_key AND f.enabled);
UPDATE public.platform_plan_role_features r SET enabled=false,updated_at=now()
WHERE r.plan_id='free' AND r.enabled AND EXISTS(
 SELECT 1 FROM public.platform_free_role_cleanup_evidence e WHERE e.plan_id=r.plan_id AND e.feature_key=r.feature_key AND e.role=r.role);

-- Installation confirmation: configuration exists, enforcement stays off.
DO $final_check$ BEGIN
 IF EXISTS(SELECT 1 FROM public.platform_plan_action_enforcement WHERE enabled)
 OR EXISTS(SELECT 1 FROM public.platform_usage_enforcement WHERE enabled) THEN
 RAISE EXCEPTION 'Unsafe enforcement state found — rolling back';END IF;
END;$final_check$;
COMMIT;
-- IMPORTANT: trials are CONFIGURATION ONLY; do not offer an active trial until a verified
-- renewal and access-expiry flow has been implemented. VAT snapshot and refund rewrite
-- must be a separate financial migration tested against the authoritative RPCs.