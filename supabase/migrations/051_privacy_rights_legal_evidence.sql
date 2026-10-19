-- BusinessOS 051: privacy rights queue and immutable legal document evidence.
-- AFTER 050. Additive: no existing customer, orders, finance or auth rows are modified.
-- Install first in a separate Supabase project and verify privileges before production.
BEGIN;
DO $$BEGIN
 IF to_regclass('public.platform_admins') IS NULL OR to_regclass('public.business_members') IS NULL
 THEN RAISE EXCEPTION 'Install earlier BusinessOS migrations through 050 first'; END IF;
 IF to_regclass('public.privacy_rights_requests') IS NOT NULL
 THEN RAISE EXCEPTION 'Migration 051 exists; inspect migration history before reapplying'; END IF;
END$$;

CREATE TABLE public.legal_document_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_key text NOT NULL CHECK (document_key IN ('terms','privacy','cookies','merchant_dpa')),
 version_label text NOT NULL CHECK (length(version_label) BETWEEN 1 AND 60),
 title text NOT NULL CHECK (length(title) BETWEEN 3 AND 180),
 content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
 effective_at timestamptz NOT NULL,
 approved_at timestamptz,
 approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewer_reference text,
 published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT legal_approved_publication CHECK (NOT published OR (
  approved_at IS NOT NULL AND approved_by IS NOT NULL AND
  reviewer_reference IS NOT NULL AND length(trim(reviewer_reference)) >= 4
 )),
 UNIQUE(document_key,version_label)
);
CREATE INDEX legal_document_public_latest ON public.legal_document_versions
 (document_key,effective_at DESC) WHERE published;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legal_document_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.legal_document_versions TO anon,authenticated;
CREATE POLICY legal_public_versions ON public.legal_document_versions FOR SELECT TO anon,authenticated USING(
 published AND approved_at IS NOT NULL AND effective_at <= now()
);
-- Legal evidence is deliberately written only by a trusted database operator, never the ordinary CMS.
CREATE FUNCTION public.prevent_published_legal_edits() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' AND OLD.published THEN RAISE EXCEPTION 'Published legal evidence is immutable'; END IF;
 IF TG_OP='UPDATE' AND OLD.published THEN RAISE EXCEPTION 'Published legal evidence is immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END$$;
REVOKE ALL ON FUNCTION public.prevent_published_legal_edits() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER legal_versions_immutable BEFORE UPDATE OR DELETE ON public.legal_document_versions
 FOR EACH ROW EXECUTE FUNCTION public.prevent_published_legal_edits();

CREATE TABLE public.user_legal_acceptances(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 source text NOT NULL CHECK (source IN ('signup','account')),
 UNIQUE(user_id,document_id)
);
CREATE INDEX user_legal_acceptances_user_time ON public.user_legal_acceptances(user_id,accepted_at DESC);
ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_legal_acceptances FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.user_legal_acceptances TO authenticated;
CREATE POLICY legal_acceptances_owner_read ON public.user_legal_acceptances FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

-- Accept only a published, effective Terms version; DB creates timestamp from the authenticated session.
CREATE FUNCTION public.accept_current_terms(p_document_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_latest uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT id INTO v_latest FROM public.legal_document_versions
 WHERE document_key='terms' AND published AND approved_at IS NOT NULL AND effective_at<=now()
 ORDER BY effective_at DESC,created_at DESC LIMIT 1;
 IF v_latest IS NULL OR p_document_id IS DISTINCT FROM v_latest
 THEN RAISE EXCEPTION 'An approved, current Terms version is required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.user_legal_acceptances(user_id,document_id,source)
 VALUES(auth.uid(),v_latest,'account') ON CONFLICT(user_id,document_id) DO NOTHING;
END$$;
REVOKE ALL ON FUNCTION public.accept_current_terms(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_current_terms(uuid) TO authenticated;

-- Signup may occur before email verification; this records the Terms acknowledgement
-- supplied to Auth at signup, only if the version is current. No existing accounts are modified.
-- Missing metadata does not prevent Supabase invitations or external signup providers.
CREATE FUNCTION public.record_businessos_signup_terms() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_latest uuid;v_submitted text;
BEGIN
 IF NEW.raw_user_meta_data->>'businessos_terms_accepted' IS DISTINCT FROM 'true' THEN RETURN NEW; END IF;
 v_submitted:=NEW.raw_user_meta_data->>'businessos_terms_document_id';
 IF v_submitted IS NULL OR v_submitted !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN RETURN NEW; END IF;
 SELECT id INTO v_latest FROM public.legal_document_versions
 WHERE document_key='terms' AND published AND approved_at IS NOT NULL AND effective_at<=now()
 ORDER BY effective_at DESC,created_at DESC LIMIT 1;
 IF v_latest IS NOT NULL AND v_latest::text=v_submitted THEN
  INSERT INTO public.user_legal_acceptances(user_id,document_id,source)
  VALUES(NEW.id,v_latest,'signup') ON CONFLICT(user_id,document_id) DO NOTHING;
 END IF;
 RETURN NEW;
END$$;
REVOKE ALL ON FUNCTION public.record_businessos_signup_terms() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER businessos_signup_legal_evidence AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.record_businessos_signup_terms();

CREATE TABLE public.privacy_rights_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK (kind IN ('access','correction','portability','deletion','restriction','objection','consent','other')),
 details text NOT NULL CHECK (length(trim(details)) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','verification_required','completed','declined')),
 admin_response text CHECK (admin_response IS NULL OR length(admin_response) <= 2000),
 assigned_admin uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz
);
CREATE INDEX privacy_rights_request_owner ON public.privacy_rights_requests(requested_by,created_at DESC);
CREATE INDEX privacy_rights_request_queue ON public.privacy_rights_requests(status,created_at DESC);
ALTER TABLE public.privacy_rights_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privacy_rights_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.privacy_rights_requests TO authenticated;
GRANT INSERT(requested_by,business_id,kind,details) ON public.privacy_rights_requests TO authenticated;
CREATE POLICY privacy_requests_own_or_admin_read ON public.privacy_rights_requests FOR SELECT TO authenticated USING(
 requested_by=auth.uid() OR EXISTS(
  SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active
 )
);
CREATE POLICY privacy_requests_submit_own ON public.privacy_rights_requests FOR INSERT TO authenticated WITH CHECK(
 requested_by=auth.uid() AND status='received' AND resolved_at IS NULL AND admin_response IS NULL
 AND (business_id IS NULL OR public.is_business_owner(business_id))
);
-- Allow only the authenticated platform administrator to update status; preserve the original request.
CREATE FUNCTION public.review_privacy_rights_request(
 p_request uuid,p_status text,p_response text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active
 ) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('reviewing','verification_required','completed','declined') OR
    length(trim(coalesce(p_response,'')))<5 OR length(p_response)>2000
 THEN RAISE EXCEPTION 'Select a valid status and a response of 5–2000 characters' USING ERRCODE='22023'; END IF;
 UPDATE public.privacy_rights_requests SET status=p_status,admin_response=trim(p_response),
  assigned_admin=auth.uid(),updated_at=now(),
  resolved_at=CASE WHEN p_status IN ('completed','declined') THEN now() ELSE NULL END
 WHERE id=p_request;
 IF NOT FOUND THEN RAISE EXCEPTION 'Privacy request not found'; END IF;
END$$;
REVOKE ALL ON FUNCTION public.review_privacy_rights_request(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_privacy_rights_request(uuid,text,text) TO authenticated;
COMMIT;
