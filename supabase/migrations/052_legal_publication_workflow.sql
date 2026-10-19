-- BusinessOS 052: controlled registration of a legally reviewed, published policy.
-- Requires SQL 051. Additive; doesn't overwrite existing legal versions or user acceptances.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.legal_document_versions') IS NULL
 THEN RAISE EXCEPTION 'Apply SQL 051 before 052'; END IF;
 IF to_regprocedure('public.register_reviewed_legal_document(text,text,text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'SQL 052 has already been installed; inspect before rerunning'; END IF;
END $$;
CREATE FUNCTION public.register_reviewed_legal_document(
 p_key text,p_version text,p_hash text,p_reviewer_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active
 ) THEN RAISE EXCEPTION 'Only the active platform administrator can register a reviewed policy' USING ERRCODE='42501'; END IF;
 IF p_key NOT IN ('privacy','terms','cookies','merchant_dpa')
 OR length(trim(coalesce(p_version,'')))<1 OR length(p_version)>60
 OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
 OR length(trim(coalesce(p_reviewer_reference,'')))<8 OR length(p_reviewer_reference)>500
 THEN RAISE EXCEPTION 'Complete the policy version, digest and actual reviewer evidence' USING ERRCODE='22023'; END IF;
 IF p_key='merchant_dpa' THEN
  RAISE EXCEPTION 'Merchant DPA requires its own signed-document workflow' USING ERRCODE='22023';
 END IF;
 -- Publication must have already been reviewed and explicitly enabled by platform owner in CMS.
 IF NOT EXISTS(
  SELECT 1 FROM public.public_site_pages p WHERE p.slug=p_key AND p.published=true
  AND jsonb_array_length(p.sections)>=2
 ) THEN RAISE EXCEPTION 'Publish a reviewed, complete legal CMS page first' USING ERRCODE='22023'; END IF;
 INSERT INTO public.legal_document_versions(
  document_key,version_label,title,content_sha256,effective_at,
  approved_at,approved_by,reviewer_reference,published
 ) VALUES(
  p_key,trim(p_version),'BusinessOS '||CASE p_key
    WHEN 'terms' THEN 'Terms of Service'
    WHEN 'privacy' THEN 'Privacy Notice' ELSE 'Cookie Notice' END,
  p_hash,now(),now(),auth.uid(),trim(p_reviewer_reference),true
 ) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.register_reviewed_legal_document(text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_reviewed_legal_document(text,text,text,text)
 TO authenticated;
COMMIT;
