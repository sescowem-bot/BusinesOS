-- BusinessOS 053 | Safer subscription approval and pricing diagnostics
-- Apply AFTER 052, and only if earlier plan migrations (016,017,029,044,048) are present.
-- This migration does not alter customer records or automatically change a subscription.
BEGIN;
DO $$
BEGIN
 IF to_regclass('public.public_site_plans') IS NULL
  OR to_regclass('public.plan_parent_links') IS NULL
  OR to_regclass('public.business_upgrade_requests') IS NULL
  OR to_regclass('public.business_plan_assignments') IS NULL
  OR to_regclass('public.business_admin_plan_audit') IS NULL
  OR to_regclass('public.legal_document_versions') IS NULL
 THEN RAISE EXCEPTION 'Required migrations through 052 not found; verify migration history first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='public_site_plans' AND column_name='price_monthly_ngn')
 THEN RAISE EXCEPTION 'Plan prices missing; verify SQL 044 before SQL 053'; END IF;
END $$;

-- Approval means a sales/admin decision, NOT verification of subscription payment.
-- A paid subscription is activated only via verified checkout or the separately
-- audited System Owner complimentary/manual subscription function.
CREATE OR REPLACE FUNCTION public.review_business_upgrade(
 p_request_id uuid,p_approve boolean,p_note text DEFAULT ''
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_request public.business_upgrade_requests%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active
 ) THEN RAISE EXCEPTION 'Platform administrator required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR length(btrim(coalesce(p_note,''))) NOT BETWEEN 5 AND 1200
 THEN RAISE EXCEPTION 'Provide a review decision and a note of at least five characters' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_request FROM public.business_upgrade_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Upgrade request not found'; END IF;
 IF v_request.status<>'pending' THEN RAISE EXCEPTION 'Request already reviewed'; END IF;
 IF p_approve AND NOT EXISTS(
  SELECT 1 FROM public.public_site_plans WHERE id=v_request.plan_id AND published
 ) THEN RAISE EXCEPTION 'Requested plan is no longer available'; END IF;
 UPDATE public.business_upgrade_requests
 SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  reviewed_by=auth.uid(), reviewed_at=now(),review_note=left(btrim(p_note),1200)
 WHERE id=p_request_id;
 -- Deliberately NO write to business_plan_assignments here.
END;$$;
REVOKE ALL ON FUNCTION public.review_business_upgrade(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_business_upgrade(uuid,boolean,text) TO authenticated;

-- Admin-only read-only state, useful when database permission or migration
-- drift causes a previously generic "plan inheritance failed" message.
CREATE OR REPLACE FUNCTION public.admin_subscription_diagnostics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active
 ) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'plan_count',(SELECT count(*) FROM public.public_site_plans),
  'published_plans',(SELECT count(*) FROM public.public_site_plans WHERE published),
  'unpriced_published_plans',(SELECT count(*) FROM public.public_site_plans
   WHERE published AND id<>'free' AND coalesce(price_monthly_ngn,0)<=0 AND coalesce(price_yearly_ngn,0)<=0),
  'plan_parent_links',(SELECT count(*) FROM public.plan_parent_links),
  'upgrade_requests_pending',(SELECT count(*) FROM public.business_upgrade_requests WHERE status='pending'),
  'parent_edit_function',to_regprocedure('public.admin_set_plan_parent(text,text)') IS NOT NULL,
  'paid_activation_function',to_regprocedure('public.activate_paid_business_plan(text,bigint,text,bigint)') IS NOT NULL
 );
END;$$;
REVOKE ALL ON FUNCTION public.admin_subscription_diagnostics() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_subscription_diagnostics() TO authenticated;

-- Append-only changes for subscription pricing and plan hierarchy.
CREATE TABLE public.platform_subscription_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entity_type text NOT NULL CHECK(entity_type IN ('plan','inheritance')),
 entity_key text NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('created','changed','removed')),
 previous_value jsonb,
 new_value jsonb,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_subscription_audit_latest ON public.platform_subscription_audit(changed_at DESC);
ALTER TABLE public.platform_subscription_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_subscription_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.platform_subscription_audit TO authenticated;
CREATE POLICY platform_subscription_audit_admin_read ON public.platform_subscription_audit
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.platform_admins p WHERE p.user_id=auth.uid() AND p.active
 ));

CREATE FUNCTION public.record_subscription_plan_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_before jsonb;v_after jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN
  v_before=jsonb_build_object('name',OLD.name,'monthly',OLD.price_monthly_ngn,
   'yearly',OLD.price_yearly_ngn,'published',OLD.published,
   'label',OLD.price_label,'sort',OLD.sort_order);
 END IF;
 v_after=jsonb_build_object('name',NEW.name,'monthly',NEW.price_monthly_ngn,
  'yearly',NEW.price_yearly_ngn,'published',NEW.published,
  'label',NEW.price_label,'sort',NEW.sort_order);
 IF TG_OP='INSERT' OR v_before IS DISTINCT FROM v_after THEN
  INSERT INTO public.platform_subscription_audit(entity_type,entity_key,event_type,
   previous_value,new_value,actor_id)
  VALUES('plan',NEW.id,CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'changed' END,
   v_before,v_after,auth.uid());
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.record_subscription_plan_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER log_subscription_plan_changes AFTER INSERT OR UPDATE ON public.public_site_plans
 FOR EACH ROW EXECUTE FUNCTION public.record_subscription_plan_change();

CREATE FUNCTION public.record_subscription_parent_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_before jsonb;v_after jsonb;v_key text;
BEGIN
 v_key=CASE WHEN TG_OP='DELETE' THEN OLD.plan_id ELSE NEW.plan_id END;
 IF TG_OP<>'INSERT' THEN v_before=jsonb_build_object('parent',OLD.parent_plan_id);END IF;
 IF TG_OP<>'DELETE' THEN v_after=jsonb_build_object('parent',NEW.parent_plan_id);END IF;
 IF TG_OP='INSERT' OR TG_OP='DELETE' OR v_before IS DISTINCT FROM v_after THEN
  INSERT INTO public.platform_subscription_audit(entity_type,entity_key,event_type,
   previous_value,new_value,actor_id)
  VALUES('inheritance',v_key,CASE WHEN TG_OP='INSERT' THEN 'created'
  WHEN TG_OP='DELETE' THEN 'removed' ELSE 'changed' END,
  v_before,v_after,auth.uid());
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.record_subscription_parent_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER log_subscription_parent_changes AFTER INSERT OR UPDATE OR DELETE ON public.plan_parent_links
 FOR EACH ROW EXECUTE FUNCTION public.record_subscription_parent_change();

COMMIT;
