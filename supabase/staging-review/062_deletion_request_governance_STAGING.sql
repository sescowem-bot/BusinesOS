-- SESCO Business App / BusinessOS Stage 063
-- NON-DESTRUCTIVE deletion/closure REQUEST management (STAGING ONLY).
-- Requires Stage 061 SQL 060 and Stage 062 SQL 061 in a separate staging project.
-- This DOES NOT delete users, memberships, business data, records or payment history.
-- Apply only after backup and manually reviewing database drift/security audit.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_member_access') IS NULL OR
    to_regclass('public.business_lifecycle_state') IS NULL OR
    to_regclass('public.platform_admins') IS NULL OR
    to_regprocedure('public.business_membership_is_active(uuid,uuid)') IS NULL OR
    to_regprocedure('public.enforce_active_member_tenant_write()') IS NULL THEN
  RAISE EXCEPTION 'Stages 061/062 missing: stop and reconcile staging schema';
 END IF;
 IF to_regclass('public.platform_deletion_requests') IS NOT NULL THEN
  RAISE EXCEPTION 'Stage 063 deletion requests already exist: inspect before retrying';
 END IF;
END $$;

-- Never tie deletion of this governance record to deletion of its subject.
CREATE TABLE public.platform_deletion_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_type text NOT NULL CHECK (request_type IN ('personal_account_erasure','business_closure')),
 subject_business_id uuid, -- historical reference remains if business is later erased through a separate process
 requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 15 AND 1000),
 status text NOT NULL DEFAULT 'received' CHECK (status IN
   ('received','verification_required','under_review','approved_for_processing','declined')),
 review_note text NOT NULL DEFAULT '' CHECK (char_length(review_note) <= 1200),
 identity_verified boolean NOT NULL DEFAULT false,
 retention_reviewed boolean NOT NULL DEFAULT false,
 payment_reviewed boolean NOT NULL DEFAULT false,
 export_considered boolean NOT NULL DEFAULT false,
 reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT business_request_requires_business CHECK (
   (request_type='business_closure' AND subject_business_id IS NOT NULL) OR
   (request_type='personal_account_erasure' AND subject_business_id IS NULL)),
 CONSTRAINT approval_requires_evidence CHECK (status<>'approved_for_processing' OR
   (identity_verified AND retention_reviewed AND payment_reviewed AND export_considered
    AND reviewed_by IS NOT NULL AND char_length(btrim(review_note)) >= 20))
);
CREATE UNIQUE INDEX platform_deletion_open_once ON public.platform_deletion_requests
 (requested_by,request_type,coalesce(subject_business_id,'00000000-0000-0000-0000-000000000000'::uuid))
 WHERE requested_by IS NOT NULL AND status NOT IN ('declined');
CREATE INDEX platform_deletion_queue_status ON public.platform_deletion_requests(status,created_at DESC);

CREATE TABLE public.platform_deletion_request_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES public.platform_deletion_requests(id) ON DELETE RESTRICT,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 from_status text,
 to_status text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_deletion_event_history ON public.platform_deletion_request_events(request_id,occurred_at DESC);
ALTER TABLE public.platform_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_deletion_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_deletion_requests,public.platform_deletion_request_events FROM PUBLIC,anon,authenticated;
-- No frontend table policies or direct writes; scoped RPCs below are the ONLY access path.

CREATE FUNCTION public.submit_platform_deletion_request(
 p_request_type text,p_business uuid,p_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user uuid := auth.uid();v_id uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_request_type NOT IN ('personal_account_erasure','business_closure') OR
    char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 15 AND 1000 THEN
  RAISE EXCEPTION 'Select a valid request and describe it in 15-1000 characters' USING ERRCODE='22023';
 END IF;
 IF p_request_type='personal_account_erasure' AND p_business IS NOT NULL THEN
  RAISE EXCEPTION 'Personal account requests must not select a business' USING ERRCODE='22023'; END IF;
 IF p_request_type='business_closure' AND (p_business IS NULL OR
   NOT EXISTS (SELECT 1 FROM public.business_members m WHERE m.business_id=p_business
     AND m.user_id=v_user AND m.role='owner') OR
   NOT public.business_membership_is_active(p_business,v_user)) THEN
  RAISE EXCEPTION 'Active business ownership is required' USING ERRCODE='42501';
 END IF;
 -- Serialise same-user submission to avoid duplicate open requests.
 PERFORM pg_advisory_xact_lock(hashtext(v_user::text),8317);
 IF EXISTS(SELECT 1 FROM public.platform_deletion_requests r WHERE r.requested_by=v_user
   AND r.request_type=p_request_type AND r.subject_business_id IS NOT DISTINCT FROM p_business
   AND r.status<>'declined') THEN
  RAISE EXCEPTION 'There is already an active request of this type' USING ERRCODE='23505';
 END IF;
 INSERT INTO public.platform_deletion_requests(request_type,subject_business_id,requested_by,reason)
 VALUES(p_request_type,p_business,v_user,btrim(p_reason)) RETURNING id INTO v_id;
 INSERT INTO public.platform_deletion_request_events(request_id,actor_id,to_status)
 VALUES(v_id,v_user,'received');
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.submit_platform_deletion_request(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_platform_deletion_request(text,uuid,text) TO authenticated;

CREATE FUNCTION public.my_platform_deletion_requests()
RETURNS TABLE(id uuid,request_type text,subject_business_id uuid,status text,
 reason text,review_note text,created_at timestamptz,reviewed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT r.id,r.request_type,r.subject_business_id,r.status,r.reason,
 r.review_note,r.created_at,r.reviewed_at
 FROM public.platform_deletion_requests r WHERE r.requested_by=auth.uid()
 ORDER BY r.created_at DESC LIMIT 50;
END;$$;
REVOKE ALL ON FUNCTION public.my_platform_deletion_requests() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.my_platform_deletion_requests() TO authenticated;

CREATE FUNCTION public.platform_deletion_review_queue()
RETURNS TABLE(id uuid,request_type text,subject_business_id uuid,requested_by uuid,
 reason text,status text,review_note text,created_at timestamptz,reviewed_at timestamptz,
 identity_verified boolean,retention_reviewed boolean,payment_reviewed boolean,export_considered boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins a
  WHERE a.user_id=auth.uid() AND a.active) THEN
  RAISE EXCEPTION 'System Owner required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT r.id,r.request_type,r.subject_business_id,r.requested_by,
 r.reason,r.status,r.review_note,r.created_at,r.reviewed_at,
 r.identity_verified,r.retention_reviewed,r.payment_reviewed,r.export_considered
 FROM public.platform_deletion_requests r
 ORDER BY (r.status='approved_for_processing') ASC,(r.status='declined') ASC,r.created_at DESC LIMIT 150;
END;$$;
REVOKE ALL ON FUNCTION public.platform_deletion_review_queue() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_deletion_review_queue() TO authenticated;

CREATE FUNCTION public.platform_review_deletion_request(
 p_request uuid,p_status text,p_note text,p_identity_verified boolean,
 p_retention_reviewed boolean,p_payment_reviewed boolean,p_export_considered boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old text;v_business uuid;v_type text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins a
  WHERE a.user_id=auth.uid() AND a.active) THEN
  RAISE EXCEPTION 'System Owner required' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('verification_required','under_review','approved_for_processing','declined') OR
   char_length(btrim(coalesce(p_note,''))) NOT BETWEEN 15 AND 1200 THEN
  RAISE EXCEPTION 'Choose a valid review status and an explanation (15-1200 chars)' USING ERRCODE='22023'; END IF;
 SELECT r.status,r.subject_business_id,r.request_type INTO v_old,v_business,v_type
 FROM public.platform_deletion_requests r WHERE r.id=p_request FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE='22023'; END IF;
 IF v_old IN ('declined','approved_for_processing') OR v_old=p_status THEN
  RAISE EXCEPTION 'This request cannot be changed from its current state' USING ERRCODE='22023'; END IF;
 IF p_status='approved_for_processing' AND NOT
  (coalesce(p_identity_verified,false) AND coalesce(p_retention_reviewed,false)
   AND coalesce(p_payment_reviewed,false) AND coalesce(p_export_considered,false)
   AND char_length(btrim(p_note))>=20) THEN
  RAISE EXCEPTION 'Complete verification and all governance checks before approving' USING ERRCODE='22023'; END IF;
 -- Approval is permission to prepare the manual fulfilment process; NOT deletion.
 UPDATE public.platform_deletion_requests SET status=p_status,review_note=btrim(p_note),
  identity_verified=coalesce(p_identity_verified,false),
  retention_reviewed=coalesce(p_retention_reviewed,false),
  payment_reviewed=coalesce(p_payment_reviewed,false),
  export_considered=coalesce(p_export_considered,false),
  reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
 WHERE id=p_request;
 INSERT INTO public.platform_deletion_request_events(request_id,actor_id,from_status,to_status)
 VALUES(p_request,auth.uid(),v_old,p_status);
END;$$;
REVOKE ALL ON FUNCTION public.platform_review_deletion_request(uuid,text,text,boolean,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_review_deletion_request(uuid,text,text,boolean,boolean,boolean,boolean) TO authenticated;

-- Important Stage 062 security correction. A missing auth user is NOT a trusted
-- service integration. The previous guard bypassed writes whenever auth.uid()
-- was NULL, which is unsafe for reachable legacy SECURITY DEFINER functions.
-- Service-role payment webhooks remain independently authenticated.
CREATE OR REPLACE FUNCTION public.enforce_active_member_tenant_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_new_business uuid; v_old_business uuid; v_user uuid := auth.uid();
        v_before jsonb; v_after jsonb;
BEGIN
 IF auth.role()='service_role' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF v_user IS NULL THEN
  RAISE EXCEPTION 'Authenticated business membership is required' USING ERRCODE='42501';
 END IF;
 IF TG_OP IN ('UPDATE','DELETE') THEN
  v_before:=to_jsonb(OLD);
  IF NULLIF(v_before->>'business_id','') IS NULL THEN
   RAISE EXCEPTION 'Tenant guard requires original business id' USING ERRCODE='42501'; END IF;
  v_old_business:=(v_before->>'business_id')::uuid;
  IF NOT public.business_membership_is_active(v_old_business,v_user) THEN
   RAISE EXCEPTION 'Business access unavailable' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN
  v_after:=to_jsonb(NEW);
  IF NULLIF(v_after->>'business_id','') IS NULL THEN
   RAISE EXCEPTION 'Tenant guard requires business id' USING ERRCODE='42501'; END IF;
  v_new_business:=(v_after->>'business_id')::uuid;
  IF NOT public.business_membership_is_active(v_new_business,v_user) THEN
   RAISE EXCEPTION 'Business access unavailable' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;$$;
REVOKE ALL ON FUNCTION public.enforce_active_member_tenant_write() FROM PUBLIC,anon,authenticated;
COMMIT;
