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
COMMIT;
