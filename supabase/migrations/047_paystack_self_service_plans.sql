-- BusinessOS 047 - verified self-service plan checkout, billing audit and renewal enforcement.
-- AFTER 046. Requires private PAYSTACK_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY on Vercel.
-- Paid access is activated ONLY through service_role RPC following verified Paystack payment.
-- Pricing must be configured in admin plans, and the plan must be published.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_tasks') IS NULL OR to_regclass('public.business_plan_assignments') IS NULL
 OR to_regclass('public.public_site_plans') IS NULL OR to_regprocedure('public.business_has_feature(uuid,text)') IS NULL
 THEN RAISE EXCEPTION 'Migration 046 or earlier prerequisites missing'; END IF;
END $$;
ALTER TABLE public.business_plan_assignments ADD COLUMN expires_at timestamptz;
ALTER TABLE public.business_plan_assignments ADD COLUMN last_paid_reference text;
CREATE TABLE public.business_subscription_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reference text NOT NULL UNIQUE CHECK(length(reference) BETWEEN 14 AND 90),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 plan_id text NOT NULL REFERENCES public.public_site_plans(id),
 billing_cycle text NOT NULL CHECK(billing_cycle IN ('monthly','yearly')),
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0),
 currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 status text NOT NULL DEFAULT 'initiated' CHECK(status IN ('initiated','paid','failed')),
 provider_transaction_id bigint UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 paid_until timestamptz
);
CREATE INDEX business_subscription_history ON public.business_subscription_payments(business_id,created_at DESC);
ALTER TABLE public.business_subscription_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_subscription_payments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_subscription_payments TO authenticated;
CREATE POLICY owner_payment_history ON public.business_subscription_payments FOR SELECT TO authenticated USING(public.is_business_owner(business_id));

-- The browser cannot insert payment records, set amounts, or approve plans.
-- This function is available ONLY to the trusted server-side Supabase service role.
CREATE FUNCTION public.activate_paid_business_plan(p_reference text,p_amount_kobo bigint,p_currency text,p_provider_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_record public.business_subscription_payments%ROWTYPE;v_until timestamptz;v_old public.business_plan_assignments%ROWTYPE;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Payment verification required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_record FROM public.business_subscription_payments WHERE reference=p_reference FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown payment reference'; END IF;
 IF v_record.status='paid' THEN RETURN true; END IF;
 IF v_record.status<>'initiated' OR v_record.amount_kobo<>p_amount_kobo OR p_currency<>'NGN' OR v_record.plan_id='free'
  OR p_provider_id IS NULL OR p_provider_id<=0 THEN RAISE EXCEPTION 'Payment does not match this subscription'; END IF;
 SELECT * INTO v_old FROM public.business_plan_assignments WHERE business_id=v_record.business_id FOR UPDATE;
 v_until := CASE WHEN v_record.billing_cycle='monthly'
  THEN (CASE WHEN v_old.plan_id=v_record.plan_id AND v_old.expires_at>now() THEN v_old.expires_at ELSE now() END)+interval '1 month'
  ELSE (CASE WHEN v_old.plan_id=v_record.plan_id AND v_old.expires_at>now() THEN v_old.expires_at ELSE now() END)+interval '1 year' END;
 UPDATE public.business_subscription_payments SET status='paid',provider_transaction_id=p_provider_id,paid_at=now(),paid_until=v_until
 WHERE reference=p_reference;
 INSERT INTO public.business_plan_assignments(business_id,plan_id,approved_request_id,approved_by,approved_at,updated_at,expires_at,last_paid_reference)
 VALUES(v_record.business_id,v_record.plan_id,NULL,NULL,now(),now(),v_until,v_record.reference)
 ON CONFLICT (business_id) DO UPDATE SET plan_id=excluded.plan_id,approved_request_id=NULL,approved_by=NULL,
 approved_at=excluded.approved_at,updated_at=now(),expires_at=excluded.expires_at,last_paid_reference=excluded.last_paid_reference;
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.activate_paid_business_plan(text,bigint,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_business_plan(text,bigint,text,bigint) TO service_role;

-- Same access behavior as SQL044, with expiry checking for payment-activated plans.
-- Existing manually approved or pilot plans with NULL expiry continue as before.
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
 SELECT plan_id INTO v_plan FROM public.business_plan_assignments WHERE business_id=p_business_id AND (expires_at IS NULL OR expires_at>now());
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
COMMIT;
