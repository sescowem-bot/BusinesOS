-- Applied via Supabase migration; DO NOT RUN AGAIN.
-- BusinessOS product/module-specific trials. Additive; no new plan assigned or charges.
BEGIN;
CREATE TABLE public.platform_plan_trial_modules (
 plan_id text NOT NULL REFERENCES public.public_site_plans(id),
 feature_key text NOT NULL CHECK(feature_key IN ('pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','insights','growth')),
 enabled boolean NOT NULL DEFAULT false,
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(plan_id,feature_key)
);
CREATE TABLE public.platform_business_trial_issues (
 business_id uuid NOT NULL REFERENCES public.businesses(id),
 feature_key text NOT NULL CHECK(feature_key IN ('pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','insights','growth')),
 offered_plan_id text NOT NULL REFERENCES public.public_site_plans(id),
 trial_days integer NOT NULL CHECK(trial_days BETWEEN 1 AND 30),
 started_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 issued_by uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(business_id,feature_key),
 CHECK(expires_at>started_at)
);
CREATE INDEX platform_business_trial_issues_expiry_idx ON public.platform_business_trial_issues(expires_at);
ALTER TABLE public.platform_plan_trial_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_business_trial_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_plan_trial_modules,public.platform_business_trial_issues FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_plan_trial_modules,public.platform_business_trial_issues TO authenticated;
CREATE POLICY platform_admin_read_trial_modules ON public.platform_plan_trial_modules
 FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY platform_admin_read_trial_issues ON public.platform_business_trial_issues
 FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()) AND a.active));
CREATE FUNCTION public.admin_set_trial_module(p_plan text,p_feature text,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_exists boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active) THEN
  RAISE EXCEPTION 'System Owner required' USING ERRCODE='42501';
 END IF;
 IF p_enabled IS NULL OR p_feature NOT IN ('pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','insights','growth') THEN
  RAISE EXCEPTION 'Invalid trial module' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id=p_plan) THEN
  RAISE EXCEPTION 'Invalid plan' USING ERRCODE='22023';
 END IF;
 WITH RECURSIVE family(id,depth) AS (
  SELECT p_plan,0 UNION ALL SELECT p.parent_plan_id,f.depth+1 FROM family f
   JOIN public.plan_parent_links p ON p.plan_id=f.id WHERE f.depth<20
 ) SELECT EXISTS(
  SELECT 1 FROM family f JOIN public.platform_plan_features pf ON pf.plan_id=f.id
  WHERE pf.feature_key=p_feature AND pf.enabled
 ) INTO v_exists;
 IF p_enabled AND NOT v_exists THEN
  RAISE EXCEPTION 'Module must be included in the selected plan before it can be offered for trial' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.platform_plan_trial_modules(plan_id,feature_key,enabled,updated_by)
 VALUES(p_plan,p_feature,p_enabled,auth.uid())
 ON CONFLICT(plan_id,feature_key) DO UPDATE
 SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
END $$;
CREATE FUNCTION public.admin_issue_business_trial(p_business uuid,p_plan text,p_feature text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_days int;v_expiry timestamptz;v_prev public.business_feature_grants%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active) THEN
  RAISE EXCEPTION 'System Owner required' USING ERRCODE='42501';
 END IF;
 IF p_business IS NULL OR p_plan IS NULL OR p_feature IS NULL THEN
  RAISE EXCEPTION 'Choose a business, plan and module' USING ERRCODE='22023';
 END IF;
 -- Serialize issuance for the same business, including attempts from two administrator sessions.
 PERFORM 1 FROM public.businesses WHERE id=p_business FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Business not found' USING ERRCODE='22023'; END IF;
 SELECT t.trial_days INTO v_days FROM public.platform_plan_trial_settings t
 JOIN public.platform_plan_trial_modules m ON m.plan_id=t.plan_id AND m.enabled AND m.feature_key=p_feature
 WHERE t.plan_id=p_plan AND t.enabled AND t.trial_days BETWEEN 1 AND 30;
 IF v_days IS NULL THEN RAISE EXCEPTION 'This module is not enabled for a trial on this plan' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_business_trial_issues
           WHERE business_id=p_business AND feature_key=p_feature) THEN
  RAISE EXCEPTION 'A trial was already issued for this module and business' USING ERRCODE='23505';
 END IF;
 SELECT * INTO v_prev FROM public.business_feature_grants
 WHERE business_id=p_business AND feature_key=p_feature FOR UPDATE;
 IF FOUND AND v_prev.enabled AND (v_prev.expires_at IS NULL OR v_prev.expires_at>now()) THEN
  RAISE EXCEPTION 'Existing active access must not be overwritten by a trial' USING ERRCODE='22023';
 END IF;
 v_expiry:=now()+make_interval(days=>v_days);
 INSERT INTO public.platform_business_trial_issues(business_id,feature_key,offered_plan_id,trial_days,expires_at,issued_by)
 VALUES(p_business,p_feature,p_plan,v_days,v_expiry,auth.uid());
 -- Existing authoritative feature guard already uses the expires_at on this grant.
 PERFORM public.admin_set_business_feature_grant(
  p_business,p_feature,true,ARRAY['owner']::text[],v_expiry,
  'Time-limited trial issued by System Owner for '||v_days||' days ('||p_plan||' plan). No payment or subscription change.'
 );
 RETURN v_expiry;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_trial_module(text,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_issue_business_trial(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_trial_module(text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_issue_business_trial(uuid,text,text) TO authenticated;
COMMIT;