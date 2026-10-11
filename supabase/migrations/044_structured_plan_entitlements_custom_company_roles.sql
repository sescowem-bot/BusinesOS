-- BusinessOS SQL 044: audited Free cleanup, numeric prices, business pricing and scoped role profiles.
-- Apply ONCE AFTER 043 in STAGING. Does not upgrade businesses or charge money.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_plan_assignments') IS NULL OR to_regclass('public.platform_plan_features') IS NULL
 OR to_regclass('public.business_feature_grants') IS NULL OR to_regclass('public.plan_parent_links') IS NULL
 OR to_regclass('public.business_member_role_audit') IS NULL THEN
  RAISE EXCEPTION 'Migrations through 043 required; inspect schema before SQL 044';
 END IF;
 IF to_regclass('public.business_company_role_profiles') IS NOT NULL THEN
  RAISE EXCEPTION 'SQL 044 already/partly installed, inspect before rerun';
 END IF;
END $$;
ALTER TABLE public.public_site_plans
 ADD COLUMN price_monthly_ngn numeric(14,2) CHECK(price_monthly_ngn>=0),
 ADD COLUMN price_yearly_ngn numeric(14,2) CHECK(price_yearly_ngn>=0);
UPDATE public.public_site_plans SET price_monthly_ngn=0,price_yearly_ngn=0,
 price_label='₦0',billing_label='Free forever' WHERE id='free';
-- Keep a snapshot of changes to Free before cleanup, so there is no silent removal.
CREATE TABLE public.platform_free_plan_cleanup_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 feature_key text,previous_enabled boolean,previous_parent text,
 changed_at timestamptz NOT NULL DEFAULT now(),note text NOT NULL
);
ALTER TABLE public.platform_free_plan_cleanup_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_free_plan_cleanup_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_free_plan_cleanup_audit TO authenticated;
CREATE POLICY admin_free_cleanup_audit_read ON public.platform_free_plan_cleanup_audit FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active));
INSERT INTO public.platform_free_plan_cleanup_audit(feature_key,previous_enabled,note)
 SELECT feature_key,enabled,'SQL 044: Free must not include paid modules directly' FROM public.platform_plan_features
 WHERE plan_id='free' AND enabled;
UPDATE public.platform_plan_features SET enabled=false,updated_at=now() WHERE plan_id='free' AND enabled;
INSERT INTO public.platform_free_plan_cleanup_audit(previous_parent,note)
 SELECT parent_plan_id,'SQL 044: Free may not inherit paid plans' FROM public.plan_parent_links WHERE plan_id='free';
DELETE FROM public.plan_parent_links WHERE plan_id='free';
CREATE FUNCTION public.prevent_free_paid_price() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.id='free' THEN
  NEW.price_monthly_ngn:=0;NEW.price_yearly_ngn:=0;NEW.price_label:='₦0';NEW.billing_label:='Free forever';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER free_prices_remain_zero BEFORE INSERT OR UPDATE ON public.public_site_plans
 FOR EACH ROW EXECUTE FUNCTION public.prevent_free_paid_price();
-- Explicit, audited business-level extras are preserved on Free and shown separately in UI.
CREATE FUNCTION public.prevent_free_entitlement_override() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='platform_plan_features' AND NEW.plan_id='free' AND NEW.enabled=true THEN
  RAISE EXCEPTION 'Free is core-only. Grant premium extras to a specific business instead';
 END IF;
 IF TG_TABLE_NAME='plan_parent_links' AND NEW.plan_id='free' THEN
  RAISE EXCEPTION 'Free must not inherit another plan';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER keep_free_core_only BEFORE INSERT OR UPDATE ON public.platform_plan_features
 FOR EACH ROW EXECUTE FUNCTION public.prevent_free_entitlement_override();
CREATE TRIGGER keep_free_without_parent BEFORE INSERT OR UPDATE ON public.plan_parent_links
 FOR EACH ROW EXECUTE FUNCTION public.prevent_free_entitlement_override();

-- Administrative commercial terms only. NOT billing, invoices, or payment execution.
CREATE TABLE public.business_feature_prices (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 feature_key text NOT NULL CHECK(feature_key IN ('pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','campaigns','insights','growth')),
 price_monthly_ngn numeric(14,2) CHECK(price_monthly_ngn>=0),
 price_yearly_ngn numeric(14,2) CHECK(price_yearly_ngn>=0),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 changed_by uuid NOT NULL REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,feature_key)
);
CREATE TABLE public.business_feature_price_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 feature_key text NOT NULL,before_value jsonb,after_value jsonb,
 changed_by uuid NOT NULL REFERENCES auth.users(id),changed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX business_feature_price_audit_recent ON public.business_feature_price_audit(business_id,changed_at DESC);
ALTER TABLE public.business_feature_price_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_feature_price_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_feature_price_audit TO authenticated;
CREATE POLICY business_price_audit_admin_read ON public.business_feature_price_audit FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active));
ALTER TABLE public.business_feature_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_feature_prices FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_feature_prices TO authenticated;
CREATE POLICY business_prices_admin_read ON public.business_feature_prices FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active)
 OR EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_feature_prices.business_id AND m.user_id=auth.uid() AND m.role='owner'));
CREATE FUNCTION public.admin_set_business_feature_price(p_business uuid,p_feature text,p_monthly numeric,p_yearly numeric,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_before jsonb;v_after jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
 RAISE EXCEPTION 'Platform admin required' USING ERRCODE='42501'; END IF;
 IF p_feature NOT IN ('pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','campaigns','insights','growth')
 OR NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business)
 OR (p_monthly IS NULL AND p_yearly IS NULL) OR p_monthly<0 OR p_yearly<0
 OR coalesce(p_monthly,0)>999999999999 OR coalesce(p_yearly,0)>999999999999
 OR p_monthly IS DISTINCT FROM round(p_monthly,2) AND p_monthly IS NOT NULL
 OR p_yearly IS DISTINCT FROM round(p_yearly,2) AND p_yearly IS NOT NULL
 OR length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Invalid commercial terms'; END IF;
 SELECT to_jsonb(f) INTO v_before FROM public.business_feature_prices f WHERE business_id=p_business AND feature_key=p_feature FOR UPDATE;
 INSERT INTO public.business_feature_prices(business_id,feature_key,price_monthly_ngn,price_yearly_ngn,note,changed_by)
 VALUES(p_business,p_feature,p_monthly,p_yearly,btrim(coalesce(p_note,'')),auth.uid())
 ON CONFLICT(business_id,feature_key) DO UPDATE SET
 price_monthly_ngn=excluded.price_monthly_ngn,price_yearly_ngn=excluded.price_yearly_ngn,
 note=excluded.note,changed_by=excluded.changed_by,updated_at=now();
 SELECT to_jsonb(f) INTO v_after FROM public.business_feature_prices f WHERE business_id=p_business AND feature_key=p_feature;
 INSERT INTO public.business_feature_price_audit(business_id,feature_key,before_value,after_value,changed_by)
 VALUES(p_business,p_feature,v_before,v_after,auth.uid());
END;$$;

-- Named company roles use an existing DB-enforced role as their maximum authority.
-- Restricting premium modules cannot elevate beyond assigned base role or commercial entitlement.
CREATE TABLE public.business_company_role_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 70),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
 base_role public.member_role NOT NULL CHECK(base_role<>'owner'),
 allowed_modules text[] NOT NULL DEFAULT ARRAY[]::text[],
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,business_id),UNIQUE(business_id,name),
 CHECK(cardinality(allowed_modules)<=11)
);
CREATE TABLE public.business_company_role_assignments (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 profile_id uuid NOT NULL,
 assigned_by uuid NOT NULL REFERENCES auth.users(id),assigned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,user_id),
 FOREIGN KEY(business_id,user_id) REFERENCES public.business_members(business_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(profile_id,business_id) REFERENCES public.business_company_role_profiles(id,business_id) ON DELETE RESTRICT
);
CREATE TABLE public.business_company_role_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 member_id uuid REFERENCES auth.users(id),profile_id uuid,
 operation text NOT NULL, before_value jsonb,after_value jsonb,
 changed_by uuid NOT NULL REFERENCES auth.users(id),changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_role_audit_lookup ON public.business_company_role_audit(business_id,changed_at DESC);
ALTER TABLE public.business_company_role_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_company_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_company_role_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_company_role_profiles,public.business_company_role_assignments,public.business_company_role_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_company_role_profiles,public.business_company_role_assignments,public.business_company_role_audit TO authenticated;
CREATE POLICY company_role_profile_admin_owner_read ON public.business_company_role_profiles FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active) OR
 EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_company_role_profiles.business_id AND m.user_id=auth.uid() AND m.role='owner'));
CREATE POLICY company_role_assign_admin_owner_member_read ON public.business_company_role_assignments FOR SELECT TO authenticated USING(
 user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active) OR
 EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_company_role_assignments.business_id AND m.user_id=auth.uid() AND m.role='owner'));
CREATE POLICY company_role_audit_admin_owner_read ON public.business_company_role_audit FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active) OR
 EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_company_role_audit.business_id AND m.user_id=auth.uid() AND m.role='owner'));

CREATE FUNCTION public.admin_save_company_role(p_business uuid,p_profile uuid,p_name text,p_description text,p_base text,p_modules text[],p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;v_before jsonb;v_after jsonb;v_old public.business_company_role_profiles%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
 RAISE EXCEPTION 'Platform admin required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business) OR length(btrim(coalesce(p_name,''))) NOT BETWEEN 3 AND 70
 OR length(coalesce(p_description,''))>500 OR p_base NOT IN ('manager','finance','sales','inventory','staff')
 OR p_active IS NULL OR p_modules IS NULL OR cardinality(p_modules)>11 OR EXISTS(
 SELECT 1 FROM unnest(p_modules) k WHERE k IS NULL OR k NOT IN ('pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','campaigns','insights','growth'))
 OR (SELECT count(*) FROM unnest(p_modules) k)<>(SELECT count(DISTINCT k) FROM unnest(p_modules) k)
 THEN RAISE EXCEPTION 'Invalid company role or modules'; END IF;
 IF p_profile IS NOT NULL THEN
  SELECT * INTO v_old FROM public.business_company_role_profiles WHERE id=p_profile AND business_id=p_business FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role profile not found'; END IF;
  IF v_old.base_role<>p_base AND EXISTS(SELECT 1 FROM public.business_company_role_assignments WHERE profile_id=p_profile) THEN
   RAISE EXCEPTION 'Remove assigned members before changing the base role'; END IF;
  v_before:=to_jsonb(v_old);
  UPDATE public.business_company_role_profiles SET name=btrim(p_name),description=btrim(coalesce(p_description,'')),base_role=p_base::public.member_role,
    allowed_modules=p_modules,active=p_active,updated_at=now() WHERE id=p_profile RETURNING id INTO v_id;
 ELSE
  INSERT INTO public.business_company_role_profiles(business_id,name,description,base_role,allowed_modules,active,created_by)
  VALUES(p_business,btrim(p_name),btrim(coalesce(p_description,'')),p_base::public.member_role,p_modules,p_active,auth.uid()) RETURNING id INTO v_id;
 END IF;
 SELECT to_jsonb(r) INTO v_after FROM public.business_company_role_profiles r WHERE id=v_id;
 INSERT INTO public.business_company_role_audit(business_id,profile_id,operation,before_value,after_value,changed_by)
 VALUES(p_business,v_id,'save_role',v_before,v_after,auth.uid());
 RETURN v_id;
END;$$;
CREATE FUNCTION public.admin_assign_company_role(p_business uuid,p_user uuid,p_profile uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile public.business_company_role_profiles%ROWTYPE;v_member public.business_members%ROWTYPE;v_before jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
 RAISE EXCEPTION 'Platform admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_member FROM public.business_members WHERE business_id=p_business AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR v_member.role='owner' THEN RAISE EXCEPTION 'Target must be an existing non-owner member'; END IF;
 SELECT * INTO v_profile FROM public.business_company_role_profiles WHERE id=p_profile AND business_id=p_business AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active company role not found'; END IF;
 SELECT to_jsonb(a) INTO v_before FROM public.business_company_role_assignments a WHERE business_id=p_business AND user_id=p_user FOR UPDATE;
 -- A named profile NEVER upgrades a member's base role automatically.
 IF v_member.role<>v_profile.base_role THEN RAISE EXCEPTION 'Change staff base role through audited owner approval first; profile cannot elevate access'; END IF;
 INSERT INTO public.business_company_role_assignments(business_id,user_id,profile_id,assigned_by)
 VALUES(p_business,p_user,p_profile,auth.uid()) ON CONFLICT(business_id,user_id)
 DO UPDATE SET profile_id=excluded.profile_id,assigned_by=excluded.assigned_by,assigned_at=now();
 INSERT INTO public.business_company_role_audit(business_id,member_id,profile_id,operation,before_value,after_value,changed_by)
 VALUES(p_business,p_user,p_profile,'assign_role',v_before,jsonb_build_object('role_profile',p_profile,'base_role',v_profile.base_role),auth.uid());
END;$$;
CREATE FUNCTION public.admin_clear_company_role(p_business uuid,p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_before jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
 RAISE EXCEPTION 'Platform admin required' USING ERRCODE='42501'; END IF;
 SELECT to_jsonb(a) INTO v_before FROM public.business_company_role_assignments a WHERE business_id=p_business AND user_id=p_user FOR UPDATE;
 IF v_before IS NULL THEN RETURN; END IF;
 DELETE FROM public.business_company_role_assignments WHERE business_id=p_business AND user_id=p_user;
 INSERT INTO public.business_company_role_audit(business_id,member_id,operation,before_value,after_value,changed_by)
 VALUES(p_business,p_user,'clear_role',v_before,'{}'::jsonb,auth.uid());
END;$$;

-- Optional custom role = additional restriction. No role profile means prior semantics.
-- Core base-role actions continue to enforce their existing separate security checks.
CREATE OR REPLACE FUNCTION public.business_has_feature(p_business_id uuid,p_feature_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_plan text;v_role public.member_role;v_custom record;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business_id AND user_id=auth.uid();
 IF v_role IS NULL THEN RETURN false; END IF;
 IF p_feature_key IN ('dashboard','customers','orders','payments','expenses','products','settings','upgrade') THEN RETURN true; END IF;
 IF p_feature_key NOT IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team','pos','purchasing') THEN RETURN false; END IF;
 IF v_role<>'owner' THEN
  SELECT r.active,r.base_role,r.allowed_modules INTO v_custom FROM public.business_company_role_assignments a
  JOIN public.business_company_role_profiles r ON r.id=a.profile_id AND r.business_id=a.business_id
  WHERE a.business_id=p_business_id AND a.user_id=auth.uid();
  IF FOUND AND (NOT v_custom.active OR v_custom.base_role<>v_role OR NOT p_feature_key=ANY(v_custom.allowed_modules)) THEN RETURN false; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.business_feature_grants g WHERE g.business_id=p_business_id AND g.feature_key=p_feature_key
  AND g.enabled AND (g.expires_at IS NULL OR g.expires_at>now()) AND v_role=ANY(g.allowed_roles)) THEN RETURN true; END IF;
 SELECT plan_id INTO v_plan FROM public.business_plan_assignments WHERE business_id=p_business_id;
 IF v_plan IS NULL THEN RETURN false; END IF;
 RETURN EXISTS (
  WITH RECURSIVE family(plan_id,depth) AS (
    SELECT v_plan,0 UNION ALL
    SELECT parent.parent_plan_id,f.depth+1 FROM family f JOIN public.plan_parent_links parent ON parent.plan_id=f.plan_id WHERE f.depth<32
  ) SELECT 1 FROM family f JOIN public.platform_plan_features pf ON pf.plan_id=f.plan_id
  WHERE pf.feature_key=p_feature_key AND pf.enabled AND (
    v_role='owner'
    OR EXISTS(SELECT 1 FROM public.platform_plan_role_features pr WHERE pr.plan_id=f.plan_id
      AND pr.feature_key=p_feature_key AND pr.role=v_role AND pr.enabled)
    OR (NOT EXISTS(SELECT 1 FROM public.platform_plan_role_features pr WHERE pr.plan_id=f.plan_id
      AND pr.feature_key=p_feature_key AND pr.role=v_role)
      AND CASE p_feature_key
        WHEN 'accounting' THEN v_role IN ('manager','finance')
        WHEN 'tax' THEN v_role IN ('manager','finance')
        WHEN 'financial_reports' THEN v_role IN ('manager','finance')
        WHEN 'communications' THEN v_role IN ('manager','sales')
        WHEN 'campaigns' THEN v_role='manager'
        WHEN 'inventory' THEN v_role IN ('manager','inventory')
        WHEN 'pos' THEN v_role IN ('manager','sales')
        WHEN 'purchasing' THEN v_role IN ('manager','inventory')
        WHEN 'insights' THEN v_role IN ('manager','finance')
        WHEN 'growth' THEN v_role='manager'
        ELSE false END)
  ) LIMIT 1);
END;$$;
REVOKE ALL ON FUNCTION public.business_has_feature(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_has_feature(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.prevent_free_entitlement_override(),public.prevent_free_paid_price() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_set_business_feature_price(uuid,text,numeric,numeric,text),
 public.admin_save_company_role(uuid,uuid,text,text,text,text[],boolean),
 public.admin_assign_company_role(uuid,uuid,uuid),public.admin_clear_company_role(uuid,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_business_feature_price(uuid,text,numeric,numeric,text),
 public.admin_save_company_role(uuid,uuid,text,text,text,text[],boolean),
 public.admin_assign_company_role(uuid,uuid,uuid),public.admin_clear_company_role(uuid,uuid) TO authenticated;
COMMIT;
