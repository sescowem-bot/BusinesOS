-- BusinessOS 049: safe, audited standard-tier alignment (manual System Owner opt-in).
-- Installing this migration DOES NOT modify subscriptions, entitlements, or published prices.
-- Run after SQL 048. To apply the recommended matrix, use System Owner > Pricing Plans
-- and explicitly confirm. Applying changes all customers on those plan IDs.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_admin_plan_audit') IS NULL
 OR to_regclass('public.platform_plan_features') IS NULL
 OR to_regclass('public.platform_plan_role_features') IS NULL
 OR to_regclass('public.plan_parent_links') IS NULL
 OR to_regclass('public.public_site_plans') IS NULL THEN
  RAISE EXCEPTION 'SQL 048 and earlier plan migrations are required';
 END IF;
 IF to_regclass('public.platform_plan_matrix_audit') IS NOT NULL THEN
  RAISE EXCEPTION 'Migration 049 appears installed; inspect before rerun';
 END IF;
END $$;

CREATE TABLE public.platform_plan_matrix_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 changed_by uuid NOT NULL REFERENCES auth.users(id),
 changed_at timestamptz NOT NULL DEFAULT now(),
 affected_businesses integer NOT NULL,
 previous_state jsonb NOT NULL,
 new_state jsonb NOT NULL,
 note text NOT NULL
);
ALTER TABLE public.platform_plan_matrix_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_plan_matrix_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_plan_matrix_audit TO authenticated;
CREATE POLICY platform_plan_matrix_admin_read ON public.platform_plan_matrix_audit
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active
 ));

CREATE FUNCTION public.admin_apply_standard_plan_matrix(p_confirmation text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_count integer;
 v_previous jsonb;
 v_after jsonb;
 v_plan text;
 v_feature text;
 v_role text;
 v_enabled boolean;
 v_allowed text[];
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active
 ) THEN RAISE EXCEPTION 'System Owner required' USING ERRCODE='42501'; END IF;
 IF p_confirmation IS DISTINCT FROM 'APPLY STANDARD PLANS' THEN
  RAISE EXCEPTION 'Explicit confirmation required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id='starter')
 OR NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id='growth') THEN
  RAISE EXCEPTION 'Starter and Growth plans must exist';
 END IF;
 -- Serialize changes to avoid an approval racing with a bulk entitlement update.
 LOCK TABLE public.platform_plan_features IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.plan_parent_links IN SHARE ROW EXCLUSIVE MODE;
 SELECT count(DISTINCT business_id) INTO v_count FROM public.business_plan_assignments
  WHERE plan_id IN ('starter','growth','professional');
 SELECT jsonb_build_object(
  'features',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM public.platform_plan_features f
   WHERE plan_id IN ('starter','growth','professional')),'[]'::jsonb),
  'roles',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.platform_plan_role_features r
   WHERE plan_id IN ('starter','growth','professional')),'[]'::jsonb),
  'parents',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.plan_parent_links p
   WHERE plan_id IN ('starter','growth','professional')),'[]'::jsonb)) INTO v_previous;
 -- Professional is a configurable, unpublished plan if it did not exist yet.
 -- Never invent prices or silently publish a new plan.
 INSERT INTO public.public_site_plans(id,name,price_label,billing_label,description,features,cta_label,cta_url,sort_order,published)
 VALUES('professional','Professional','Contact us for pricing','Advanced business management',
  'For businesses that need deeper accounting, reporting and oversight.',
  '["Retail operations","Stock and purchasing","Accounting and reporting"]'::jsonb,
  'Compare plans','/pricing',30,false)
 ON CONFLICT(id) DO NOTHING;
 -- Unlink old inheritance for only these standard plans; matrix below is explicit.
 DELETE FROM public.plan_parent_links WHERE plan_id IN ('starter','growth','professional');
 FOREACH v_plan IN ARRAY ARRAY['starter','growth','professional'] LOOP
  FOREACH v_feature IN ARRAY ARRAY['pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','campaigns','insights','growth'] LOOP
   v_enabled := CASE v_plan
    WHEN 'starter' THEN v_feature IN ('pos')
    WHEN 'growth' THEN v_feature IN ('pos','purchasing','inventory','team')
    ELSE v_feature IN ('pos','purchasing','inventory','team','accounting','financial_reports','tax','insights','growth','communications') END;
   INSERT INTO public.platform_plan_features(plan_id,feature_key,enabled,updated_by,updated_at)
   VALUES(v_plan,v_feature,v_enabled,auth.uid(),now())
   ON CONFLICT(plan_id,feature_key) DO UPDATE SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
   v_allowed := CASE v_feature
    WHEN 'pos' THEN ARRAY['manager','sales']
    WHEN 'purchasing' THEN ARRAY['manager','inventory']
    WHEN 'inventory' THEN ARRAY['manager','inventory']
    WHEN 'team' THEN ARRAY['manager']
    WHEN 'accounting' THEN ARRAY['manager','finance']
    WHEN 'financial_reports' THEN ARRAY['manager','finance']
    WHEN 'tax' THEN ARRAY['manager','finance']
    WHEN 'communications' THEN ARRAY['manager','sales']
    WHEN 'campaigns' THEN ARRAY['manager']
    WHEN 'insights' THEN ARRAY['manager','finance']
    ELSE ARRAY['manager'] END;
   FOREACH v_role IN ARRAY ARRAY['manager','finance','sales','inventory','staff'] LOOP
    INSERT INTO public.platform_plan_role_features(plan_id,feature_key,role,enabled,updated_by,updated_at)
    VALUES(v_plan,v_feature,v_role::public.member_role,(v_enabled AND v_role=ANY(v_allowed)),auth.uid(),now())
    ON CONFLICT(plan_id,feature_key,role) DO UPDATE SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
   END LOOP;
  END LOOP;
 END LOOP;
 SELECT jsonb_build_object(
  'features',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM public.platform_plan_features f
   WHERE plan_id IN ('starter','growth','professional')),'[]'::jsonb),
  'roles',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.platform_plan_role_features r
   WHERE plan_id IN ('starter','growth','professional')),'[]'::jsonb)) INTO v_after;
 INSERT INTO public.platform_plan_matrix_audit(changed_by,affected_businesses,previous_state,new_state,note)
 VALUES(auth.uid(),v_count,v_previous,v_after,
  'Explicit System Owner standard-tier alignment. Existing assigned customers experience these permissions immediately. Custom company grants retained. Prices unchanged.');
 RETURN v_count;
END;$$;
REVOKE ALL ON FUNCTION public.admin_apply_standard_plan_matrix(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_standard_plan_matrix(text) TO authenticated;
COMMIT;
