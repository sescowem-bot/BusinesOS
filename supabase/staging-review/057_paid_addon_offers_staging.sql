-- BusinessOS 057: paid feature offers, isolated STAGING TEST ONLY.
-- REVIEW FIRST. Back up staging DB; requires 029 and 047. Do not apply to production.
-- The payment RPC is callable by service_role ONLY following Paystack verification.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_feature_grants') IS NULL
 OR to_regclass('public.business_feature_grant_audit') IS NULL
 OR to_regclass('public.business_plan_assignments') IS NULL
 OR to_regclass('public.business_members') IS NULL
 OR to_regprocedure('public.is_business_owner(uuid)') IS NULL
 THEN RAISE EXCEPTION 'Add-on prerequisites SQL 029/047 missing'; END IF;
END $$;

CREATE TABLE public.business_feature_addon_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 feature_key text NOT NULL CHECK(feature_key IN (
  'accounting','tax','financial_reports','communications','inventory','insights','growth','team')),
 amount_kobo bigint NOT NULL CHECK(amount_kobo BETWEEN 100 AND 999999999999),
 currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 duration_days integer NOT NULL CHECK(duration_days BETWEEN 1 AND 366),
 allowed_roles public.member_role[] NOT NULL DEFAULT ARRAY['owner']::public.member_role[],
 note text NOT NULL CHECK(length(note) BETWEEN 8 AND 1000),
 status text NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','paid','cancelled')),
 offer_expires_at timestamptz NOT NULL DEFAULT (now()+interval '14 days'),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 CHECK(array_length(allowed_roles,1) BETWEEN 1 AND 6),
 CHECK('owner'::public.member_role=ANY(allowed_roles))
);
CREATE INDEX addon_offers_business_latest ON public.business_feature_addon_offers(business_id,created_at DESC);
ALTER TABLE public.business_feature_addon_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_feature_addon_offers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_feature_addon_offers TO authenticated;
CREATE POLICY addon_offers_owner_or_admin ON public.business_feature_addon_offers
 FOR SELECT TO authenticated USING (
  public.is_business_owner(business_id)
  OR EXISTS(SELECT 1 FROM public.platform_admins p WHERE p.user_id=auth.uid() AND p.active)
 );

CREATE TABLE public.business_feature_addon_payments (
 reference text PRIMARY KEY CHECK(reference ~ '^boa_[A-Za-z0-9_-]{14,80}$'),
 offer_id uuid NOT NULL REFERENCES public.business_feature_addon_offers(id),
 business_id uuid NOT NULL REFERENCES public.businesses(id),
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0),
 status text NOT NULL DEFAULT 'initiated' CHECK(status IN ('initiated','paid','failed')),
 provider_transaction_id bigint UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 access_expires_at timestamptz
);
CREATE INDEX addon_payments_business_latest ON public.business_feature_addon_payments(business_id,created_at DESC);
ALTER TABLE public.business_feature_addon_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_feature_addon_payments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_feature_addon_payments TO authenticated;
CREATE POLICY addon_payments_owner_or_admin ON public.business_feature_addon_payments
 FOR SELECT TO authenticated USING (
  public.is_business_owner(business_id)
  OR EXISTS(SELECT 1 FROM public.platform_admins p WHERE p.user_id=auth.uid() AND p.active)
 );
-- Service-role key lives ONLY on the staging server, never in browser code.
GRANT SELECT,INSERT,UPDATE ON public.business_feature_addon_payments TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.business_feature_addon_offers TO service_role;

CREATE FUNCTION public.admin_create_paid_addon_offer(
 p_business uuid,p_feature text,p_amount_kobo bigint,p_duration_days integer,
 p_roles text[],p_note text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; v_plan text; v_included boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active
 ) THEN RAISE EXCEPTION 'System Owner access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business)
 THEN RAISE EXCEPTION 'Business not found'; END IF;
 IF p_feature NOT IN ('accounting','tax','financial_reports','communications','inventory','insights','growth','team')
 OR p_amount_kobo NOT BETWEEN 100 AND 999999999999
 OR p_duration_days NOT BETWEEN 1 AND 366
 OR p_note IS NULL OR length(trim(p_note)) NOT BETWEEN 8 AND 1000
 OR p_roles IS NULL OR cardinality(p_roles) NOT BETWEEN 1 AND 6
 OR NOT 'owner'=ANY(p_roles)
 OR EXISTS(SELECT 1 FROM unnest(p_roles) v WHERE v NOT IN ('owner','manager','finance','sales','inventory','staff'))
 THEN RAISE EXCEPTION 'Invalid add-on quote details'; END IF;
 -- Do not sell an add-on the business is already entitled to indefinitely.
 IF EXISTS(SELECT 1 FROM public.business_feature_grants g
  WHERE g.business_id=p_business AND g.feature_key=p_feature
  AND g.enabled AND g.expires_at IS NULL)
 THEN RAISE EXCEPTION 'Business already has an indefinite grant for this feature'; END IF;
 SELECT a.plan_id INTO v_plan FROM public.business_plan_assignments a
 WHERE a.business_id=p_business AND (a.expires_at IS NULL OR a.expires_at>now());
 IF v_plan IS NOT NULL THEN
  WITH RECURSIVE family(plan_id,depth) AS (
   SELECT v_plan,0 UNION ALL
   SELECT parent.parent_plan_id,f.depth+1 FROM family f
   JOIN public.plan_parent_links parent ON parent.plan_id=f.plan_id WHERE f.depth<32
  )
  SELECT EXISTS(SELECT 1 FROM family f
    JOIN public.platform_plan_features pf ON pf.plan_id=f.plan_id
    WHERE pf.feature_key=p_feature AND pf.enabled) INTO v_included;
  IF v_included THEN RAISE EXCEPTION 'This module is already included in the business subscription'; END IF;
 END IF;
 INSERT INTO public.business_feature_addon_offers
  (business_id,feature_key,amount_kobo,duration_days,allowed_roles,note,created_by)
 VALUES (p_business,p_feature,p_amount_kobo,p_duration_days,p_roles::public.member_role[],trim(p_note),auth.uid())
 RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.admin_create_paid_addon_offer(uuid,text,bigint,integer,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_create_paid_addon_offer(uuid,text,bigint,integer,text[],text) TO authenticated;

CREATE FUNCTION public.activate_paid_feature_addon(
 p_reference text,p_amount_kobo bigint,p_currency text,p_provider_id bigint
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_payment public.business_feature_addon_payments%ROWTYPE;
 v_offer public.business_feature_addon_offers%ROWTYPE;
 v_existing public.business_feature_grants%ROWTYPE;
 v_before jsonb; v_after jsonb; v_until timestamptz;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Verified server payment required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_payment FROM public.business_feature_addon_payments
 WHERE reference=p_reference FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown add-on payment'; END IF;
 IF v_payment.status='paid' THEN
  RETURN v_payment.amount_kobo=p_amount_kobo AND p_currency='NGN'
   AND v_payment.provider_transaction_id=p_provider_id;
 END IF;
 SELECT * INTO v_offer FROM public.business_feature_addon_offers
 WHERE id=v_payment.offer_id FOR UPDATE;
 IF NOT FOUND OR v_offer.status<>'offered' OR v_offer.offer_expires_at<=now()
  OR v_payment.business_id<>v_offer.business_id
  OR v_payment.status<>'initiated' OR v_payment.amount_kobo<>p_amount_kobo
  OR v_offer.amount_kobo<>p_amount_kobo OR p_currency<>'NGN'
  OR p_provider_id IS NULL OR p_provider_id<=0
 THEN RAISE EXCEPTION 'Payment does not match active add-on offer'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_members m
  WHERE m.business_id=v_offer.business_id AND m.user_id=v_payment.owner_id AND m.role='owner')
 THEN RAISE EXCEPTION 'Payer is no longer business owner'; END IF;
 SELECT * INTO v_existing FROM public.business_feature_grants
 WHERE business_id=v_offer.business_id AND feature_key=v_offer.feature_key FOR UPDATE;
 v_before:=CASE WHEN FOUND THEN to_jsonb(v_existing) ELSE NULL END;
 -- Never shorten existing paid periods. An indefinite courtesy grant is retained.
 v_until:=CASE WHEN v_existing.enabled AND v_existing.expires_at IS NULL AND v_before IS NOT NULL
   THEN NULL
   WHEN v_existing.enabled AND v_existing.expires_at>now()
   THEN v_existing.expires_at + make_interval(days=>v_offer.duration_days)
   ELSE now()+make_interval(days=>v_offer.duration_days) END;
 INSERT INTO public.business_feature_grants
   (business_id,feature_key,enabled,allowed_roles,expires_at,note,updated_by)
 VALUES (v_offer.business_id,v_offer.feature_key,true,v_offer.allowed_roles,v_until,
   'Verified paid add-on, ref '||p_reference, v_offer.created_by)
 ON CONFLICT(business_id,feature_key) DO UPDATE
 SET enabled=true,allowed_roles=EXCLUDED.allowed_roles,expires_at=EXCLUDED.expires_at,
  note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=now();
 SELECT to_jsonb(g) INTO v_after FROM public.business_feature_grants g
 WHERE g.business_id=v_offer.business_id AND g.feature_key=v_offer.feature_key;
 INSERT INTO public.business_feature_grant_audit
 (business_id,feature_key,before_value,after_value,changed_by)
 VALUES(v_offer.business_id,v_offer.feature_key,v_before,v_after,v_offer.created_by);
 UPDATE public.business_feature_addon_payments
 SET status='paid',provider_transaction_id=p_provider_id,paid_at=now(),access_expires_at=v_until
 WHERE reference=p_reference;
 UPDATE public.business_feature_addon_offers SET status='paid',paid_at=now() WHERE id=v_offer.id;
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.activate_paid_feature_addon(text,bigint,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_feature_addon(text,bigint,text,bigint) TO service_role;
COMMIT;
