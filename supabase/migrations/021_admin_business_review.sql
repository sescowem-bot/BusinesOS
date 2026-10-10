-- BusinessOS Phase 022 / migration 021: secure internal business review.
-- Apply once AFTER migrations 001-020. Does not delete or overwrite business records.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.businesses') IS NULL
    OR to_regclass('public.platform_admins') IS NULL
    OR to_regclass('public.business_plan_assignments') IS NULL
 THEN RAISE EXCEPTION 'Required prior BusinessOS migrations are missing. Stop and inspect the database.';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_business_review_notes (
 business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
 review_status text NOT NULL DEFAULT 'open' CHECK (review_status IN ('open','review','resolved')),
 note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 3000),
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.platform_business_review_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 previous_status text,
 current_status text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_business_review_audit_business ON public.platform_business_review_audit(business_id,changed_at DESC);
ALTER TABLE public.platform_business_review_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_business_review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_business_review_notes,public.platform_business_review_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.platform_business_review_audit_id_seq FROM PUBLIC,anon,authenticated;
-- No direct client-side policies. All access is through explicitly gated RPCs.

CREATE OR REPLACE FUNCTION public.platform_business_detail(p_business_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active=true
 ) THEN RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
   'id',b.id,'name',b.name,'slug',b.slug,'category',b.category,
   'email',b.email,'phone',b.phone,'city',b.city,'state',b.state,'country',b.country,
   'created_at',b.created_at,'published',b.published,'verified',b.verified,
   'plan_id',(SELECT pa.plan_id FROM public.business_plan_assignments pa WHERE pa.business_id=b.id),
   'members',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'user_id',bm.user_id,'full_name',p.full_name,'role',bm.role,'joined_at',bm.created_at
     ) ORDER BY bm.created_at DESC)
      FROM public.business_members bm LEFT JOIN public.profiles p ON p.id=bm.user_id
      WHERE bm.business_id=b.id),'[]'::jsonb),
   'pending_upgrades',(SELECT count(*) FROM public.business_upgrade_requests r WHERE r.business_id=b.id AND r.status='pending'),
   'review', (SELECT jsonb_build_object('status',n.review_status,'note',n.note,'updated_at',n.updated_at)
       FROM public.platform_business_review_notes n WHERE n.business_id=b.id),
   'review_history',coalesce((SELECT jsonb_agg(jsonb_build_object('status',sub.current_status,'changed_at',sub.changed_at)
      ORDER BY sub.changed_at DESC) FROM (
         SELECT current_status,changed_at FROM public.platform_business_review_audit
         WHERE business_id=b.id ORDER BY changed_at DESC LIMIT 15
       ) sub),'[]'::jsonb)
 ) INTO result FROM public.businesses b WHERE b.id=p_business_id;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.platform_business_detail(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_business_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_save_business_review(p_business_id uuid,p_status text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active=true
 ) THEN RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('open','review','resolved') OR p_status IS NULL THEN
  RAISE EXCEPTION 'Invalid review status' USING ERRCODE='22023'; END IF;
 IF p_note IS NULL OR char_length(p_note)>3000 THEN
  RAISE EXCEPTION 'Review note must contain 3000 characters or fewer' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=p_business_id) THEN
  RAISE EXCEPTION 'Business not found' USING ERRCODE='22023'; END IF;
 -- Locks the existing review row where present; concurrent first writes are serialized by the PK.
 SELECT review_status INTO previous_status FROM public.platform_business_review_notes
  WHERE business_id=p_business_id FOR UPDATE;
 INSERT INTO public.platform_business_review_notes(business_id,review_status,note,updated_by,updated_at)
 VALUES (p_business_id,p_status,trim(p_note),auth.uid(),now())
 ON CONFLICT(business_id) DO UPDATE SET
 review_status=excluded.review_status,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 INSERT INTO public.platform_business_review_audit(business_id,actor_id,previous_status,current_status)
 VALUES (p_business_id,auth.uid(),previous_status,p_status);
END;$$;
REVOKE ALL ON FUNCTION public.platform_save_business_review(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_save_business_review(uuid,text,text) TO authenticated;
COMMIT;
