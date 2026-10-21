-- BUSINESSOS SQL 058: Privacy request fulfilment and review evidence.
-- Apply ONLY to a separate staging Supabase project after SQL 051/052.
-- No deletion or modification of customer/financial data. No legal documents published.
BEGIN;
DO $$
BEGIN
 IF to_regclass('public.privacy_rights_requests') IS NULL
    OR to_regclass('public.privacy_rights_request_events') IS NULL
    OR to_regclass('public.platform_admins') IS NULL
    OR to_regprocedure('public.review_privacy_rights_request(uuid,text,text)') IS NULL
 THEN RAISE EXCEPTION 'Privacy schema from SQL 051 is missing; stop without changes'; END IF;
 IF to_regclass('public.privacy_fulfilment_evidence') IS NOT NULL THEN
  RAISE EXCEPTION 'Privacy fulfilment schema already exists; inspect migration history';
 END IF;
END $$;

CREATE TABLE public.privacy_fulfilment_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 -- Keep a pseudonymous request reference without a restrictive FK: account
 -- erasure must not be blocked by audit evidence. The trusted write RPC below
 -- validates the live request before inserting. Audit retention requires policy.
 request_id uuid NOT NULL,
 action_type text NOT NULL CHECK (action_type IN (
  'access_export','correction_confirmed','portability_export','erasure_completed',
  'restriction_applied','objection_actioned','consent_change','other_resolution'
 )),
 identity_method text NOT NULL CHECK (identity_method IN (
  'authenticated_account','verified_offline','authorised_controller'
 )),
 action_summary text NOT NULL CHECK(length(btrim(action_summary)) BETWEEN 30 AND 1500),
 evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference)) BETWEEN 8 AND 180),
 confirmed_by uuid NOT NULL REFERENCES auth.users(id),
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX privacy_fulfilment_request_recent ON public.privacy_fulfilment_evidence(request_id,confirmed_at DESC);
ALTER TABLE public.privacy_fulfilment_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privacy_fulfilment_evidence FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.privacy_fulfilment_evidence TO authenticated;
CREATE POLICY privacy_evidence_admin_select ON public.privacy_fulfilment_evidence
 FOR SELECT TO authenticated USING (EXISTS (
   SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active
 ));
-- No direct INSERT/UPDATE/DELETE grants to logged-in users; only the vetted RPC writes.

CREATE FUNCTION public.admin_record_privacy_fulfilment(
 p_request uuid,p_action_type text,p_identity_method text,
 p_summary text,p_evidence_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_request public.privacy_rights_requests%ROWTYPE; v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active
 ) THEN RAISE EXCEPTION 'Platform administrator required' USING ERRCODE='42501'; END IF;
 IF p_action_type IS NULL OR p_action_type NOT IN (
   'access_export','correction_confirmed','portability_export','erasure_completed',
   'restriction_applied','objection_actioned','consent_change','other_resolution'
 ) OR p_identity_method IS NULL OR p_identity_method NOT IN (
   'authenticated_account','verified_offline','authorised_controller'
 ) OR length(btrim(coalesce(p_summary,''))) NOT BETWEEN 30 AND 1500
 OR length(btrim(coalesce(p_evidence_reference,''))) NOT BETWEEN 8 AND 180
 THEN RAISE EXCEPTION 'Provide a valid performed action, verification method, summary and evidence reference'
 USING ERRCODE='22023'; END IF;
 SELECT * INTO v_request FROM public.privacy_rights_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Privacy request not found'; END IF;
 IF v_request.status IN ('completed','declined') THEN
  RAISE EXCEPTION 'A closed privacy request cannot be edited'; END IF;
 -- Prevent self-approval when the requester is also a platform administrator.
 IF v_request.requested_by=auth.uid() THEN
  RAISE EXCEPTION 'A second authorised administrator must verify your own request'
  USING ERRCODE='42501'; END IF;
 IF (v_request.kind='deletion' AND p_action_type<>'erasure_completed') OR
    (v_request.kind='access' AND p_action_type<>'access_export') OR
    (v_request.kind='portability' AND p_action_type<>'portability_export') OR
    (v_request.kind='correction' AND p_action_type<>'correction_confirmed') OR
    (v_request.kind='restriction' AND p_action_type<>'restriction_applied') OR
    (v_request.kind='objection' AND p_action_type<>'objection_actioned') OR
    (v_request.kind='consent' AND p_action_type<>'consent_change')
 THEN RAISE EXCEPTION 'The completion type must match the request type' USING ERRCODE='22023'; END IF;
 INSERT INTO public.privacy_fulfilment_evidence (
  request_id,action_type,identity_method,action_summary,evidence_reference,confirmed_by
 ) VALUES (p_request,p_action_type,p_identity_method,btrim(p_summary),btrim(p_evidence_reference),auth.uid())
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_record_privacy_fulfilment(uuid,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_privacy_fulfilment(uuid,text,text,text,text) TO authenticated;

-- Prevent recording a completed status before action evidence. A recorded action
-- is a human attestation, NOT an automated export/deletion/notification.
CREATE OR REPLACE FUNCTION public.review_privacy_rights_request(
 p_request uuid,p_status text,p_response text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.privacy_rights_requests%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active
 ) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('reviewing','verification_required','completed','declined')
    OR length(btrim(coalesce(p_response,''))) NOT BETWEEN 10 AND 2000
 THEN RAISE EXCEPTION 'Choose a status and give a response between 10 and 2000 characters'
 USING ERRCODE='22023'; END IF;
 SELECT * INTO v_request FROM public.privacy_rights_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF v_request.status IN ('completed','declined') THEN
  RAISE EXCEPTION 'This request is already closed'; END IF;
 IF p_status='completed' AND NOT EXISTS (
  SELECT 1 FROM public.privacy_fulfilment_evidence e WHERE e.request_id=p_request
 ) THEN RAISE EXCEPTION 'Record verification and performed-action evidence before completion'
 USING ERRCODE='22023'; END IF;
 UPDATE public.privacy_rights_requests SET status=p_status,
  admin_response=btrim(p_response),assigned_admin=auth.uid(),updated_at=now(),
  resolved_at=CASE WHEN p_status IN ('completed','declined') THEN now() ELSE NULL END
 WHERE id=p_request;
END $$;
REVOKE ALL ON FUNCTION public.review_privacy_rights_request(uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_privacy_rights_request(uuid,text,text) TO authenticated;

-- Ensure fulfilment evidence itself is append-only even to privileged SQL callers.
CREATE FUNCTION public.prevent_privacy_evidence_changes() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Privacy fulfilment evidence is append-only';
END $$;
CREATE TRIGGER privacy_fulfilment_append_only BEFORE UPDATE OR DELETE ON public.privacy_fulfilment_evidence
 FOR EACH ROW EXECUTE FUNCTION public.prevent_privacy_evidence_changes();
REVOKE ALL ON FUNCTION public.prevent_privacy_evidence_changes() FROM PUBLIC,anon,authenticated;
COMMIT;
