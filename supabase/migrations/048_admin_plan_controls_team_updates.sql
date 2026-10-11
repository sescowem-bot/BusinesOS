-- BusinessOS 048 | Business-owned team updates and audited system-owner subscription assignment
-- APPLY AFTER 047 IN STAGING. This migration does not access private business transactions.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_subscription_payments') IS NULL OR
    to_regclass('public.business_tasks') IS NULL OR
    to_regclass('public.business_plan_assignments') IS NULL OR
    to_regclass('public.platform_admins') IS NULL OR
    to_regclass('public.business_member_labels') IS NULL THEN
  RAISE EXCEPTION 'SQL 046 and 047 are required before 048';
 END IF;
 IF to_regclass('public.business_admin_plan_audit') IS NOT NULL OR
    to_regclass('public.business_team_updates') IS NOT NULL THEN
  RAISE EXCEPTION 'SQL 048 appears present or partially installed. Inspect before running again.';
 END IF;
END $$;

-- Explicit system-owner assignments, separate from payment confirmations.
CREATE TABLE public.business_admin_plan_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 previous_plan_id text,
 new_plan_id text NOT NULL,
 previous_expiry timestamptz,
 new_expiry timestamptz,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 12 AND 500),
 changed_by uuid NOT NULL REFERENCES auth.users(id),
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_admin_plan_audit_lookup ON public.business_admin_plan_audit(business_id,changed_at DESC);
ALTER TABLE public.business_admin_plan_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_admin_plan_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_admin_plan_audit TO authenticated;
CREATE POLICY active_platform_admin_reads_plan_history ON public.business_admin_plan_audit
 FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active
));

CREATE FUNCTION public.admin_assign_business_subscription(
 p_business uuid,p_plan text,p_reason text,p_expires_at timestamptz DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_existing public.business_plan_assignments%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active
 ) THEN RAISE EXCEPTION 'Platform administrator required' USING ERRCODE='42501'; END IF;
 IF p_business IS NULL OR NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business)
  OR p_plan IS NULL OR NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id=p_plan AND published)
  OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 500
  OR (p_expires_at IS NOT NULL AND p_expires_at<=now())
 THEN RAISE EXCEPTION 'Select a published plan, an active business and an explanation of at least 12 characters'; END IF;
 -- An expiry is explicit for courtesy access and never inferred from a displayed price.
 SELECT * INTO v_existing FROM public.business_plan_assignments WHERE business_id=p_business FOR UPDATE;
 INSERT INTO public.business_plan_assignments(
  business_id,plan_id,approved_request_id,approved_by,approved_at,updated_at,expires_at,last_paid_reference
 ) VALUES(p_business,p_plan,NULL,auth.uid(),now(),now(),p_expires_at,NULL)
 ON CONFLICT(business_id) DO UPDATE SET
  plan_id=excluded.plan_id,approved_request_id=NULL,approved_by=excluded.approved_by,
  approved_at=excluded.approved_at,updated_at=now(),expires_at=excluded.expires_at,
  last_paid_reference=NULL;
 INSERT INTO public.business_admin_plan_audit(
  business_id,previous_plan_id,new_plan_id,previous_expiry,new_expiry,reason,changed_by
 ) VALUES(p_business,v_existing.plan_id,p_plan,v_existing.expires_at,p_expires_at,btrim(p_reason),auth.uid());
END;$$;
REVOKE ALL ON FUNCTION public.admin_assign_business_subscription(uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_business_subscription(uuid,text,text,timestamptz) TO authenticated;

-- Team notices are strictly intra-business. No customer inbox, email or SMS is implied.
CREATE TABLE public.business_team_updates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES auth.users(id),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(business_id,author_id) REFERENCES public.business_members(business_id,user_id) ON DELETE CASCADE
);
CREATE INDEX business_team_updates_recent ON public.business_team_updates(business_id,created_at DESC);
ALTER TABLE public.business_team_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_team_updates FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_team_updates TO authenticated;
CREATE POLICY team_updates_business_members_only ON public.business_team_updates FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_team_updates.business_id AND m.user_id=auth.uid()));

CREATE FUNCTION public.business_post_team_update(p_business uuid,p_body text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'This business is not available to your account' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_body,''))) NOT BETWEEN 1 AND 2000 THEN
  RAISE EXCEPTION 'Enter a message with up to 2000 characters'; END IF;
 INSERT INTO public.business_team_updates(business_id,author_id,body)
 VALUES(p_business,auth.uid(),btrim(p_body)) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.business_post_team_update(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_post_team_update(uuid,text) TO authenticated;
-- Enforce paid team/branch entitlements on DIRECT table writes, not just page navigation.
-- Core staff invitations and team updates remain available to a business owner on Free.
CREATE FUNCTION public.enforce_advanced_team_entitlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_setting('request.jwt.claim.role',true)='service_role' THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL OR NOT public.business_has_feature(NEW.business_id,'team') THEN
  RAISE EXCEPTION 'Advanced team access required' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.enforce_advanced_team_entitlement() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER restrict_branch_changes_to_entitled_businesses
 BEFORE INSERT OR UPDATE ON public.business_branches
 FOR EACH ROW EXECUTE FUNCTION public.enforce_advanced_team_entitlement();
CREATE TRIGGER restrict_approval_changes_to_entitled_businesses
 BEFORE INSERT OR UPDATE ON public.business_approval_requests
 FOR EACH ROW EXECUTE FUNCTION public.enforce_advanced_team_entitlement();

COMMIT;
