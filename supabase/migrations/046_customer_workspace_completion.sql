-- BusinessOS 046: working tasks, entitlement-aware navigation, business media and safe public listings.
-- AFTER SQL 045. Review on staging and back up production first.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.business_has_feature(uuid,text)') IS NULL
  OR to_regclass('public.business_company_role_profiles') IS NULL
  OR to_regclass('public.business_plan_assignments') IS NULL
 THEN RAISE EXCEPTION 'Apply/verify SQL 043 through 045 before 046'; END IF;
END $$;

-- Return only currently accessible premium capabilities in one scoped RPC; no client-defined entitlements.
CREATE FUNCTION public.business_workspace_features(p_business uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_features text[] := '{}'; v_key text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_business_member(p_business) THEN RETURN v_features; END IF;
 FOREACH v_key IN ARRAY ARRAY['pos','purchasing','inventory','team','accounting','financial_reports','tax','communications','campaigns','insights','growth'] LOOP
  IF public.business_has_feature(p_business,v_key) THEN v_features:=array_append(v_features,v_key); END IF;
 END LOOP;
 RETURN v_features;
END;$$;
REVOKE ALL ON FUNCTION public.business_workspace_features(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_workspace_features(uuid) TO authenticated;

-- Business-specific display names are aliases, not changes to another person's login identity.
CREATE TABLE public.business_member_labels (
 business_id uuid NOT NULL,
 user_id uuid NOT NULL,
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 2 AND 100),
 changed_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,user_id),
 FOREIGN KEY(business_id,user_id) REFERENCES public.business_members(business_id,user_id) ON DELETE CASCADE
);
ALTER TABLE public.business_member_labels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_member_labels FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_member_labels TO authenticated;
CREATE POLICY business_member_labels_read ON public.business_member_labels FOR SELECT TO authenticated
 USING(public.is_business_member(business_id));
CREATE FUNCTION public.business_name_staff_member(p_business uuid,p_member uuid,p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_business_owner(p_business)
  OR NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=p_member)
  OR length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 100
 THEN RAISE EXCEPTION 'A valid team member and display name are required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.business_member_labels(business_id,user_id,display_name,changed_by)
 VALUES(p_business,p_member,btrim(p_name),auth.uid())
 ON CONFLICT(business_id,user_id) DO UPDATE SET display_name=excluded.display_name,changed_by=excluded.changed_by,updated_at=now();
END;$$;
REVOKE ALL ON FUNCTION public.business_name_staff_member(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_name_staff_member(uuid,uuid,text) TO authenticated;

-- A small, real task feature. Task management is business-owned, never an admin quotation.
CREATE TABLE public.business_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 180),
 details text NOT NULL DEFAULT '' CHECK(length(details)<=1500),
 assigned_to uuid,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 due_on date,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(business_id,assigned_to) REFERENCES public.business_members(business_id,user_id)
);
CREATE INDEX business_tasks_recent ON public.business_tasks(business_id,completed_at,due_on,created_at DESC);
ALTER TABLE public.business_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_tasks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_tasks TO authenticated;
CREATE POLICY business_tasks_read ON public.business_tasks FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_tasks.business_id AND m.user_id=auth.uid() AND (m.role IN ('owner','manager') OR business_tasks.assigned_to=auth.uid() OR business_tasks.created_by=auth.uid())));
CREATE FUNCTION public.business_save_task(p_business uuid,p_title text,p_details text,p_assigned uuid,p_due_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role public.member_role;v_id uuid;
BEGIN
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL OR v_role NOT IN ('owner','manager') THEN RAISE EXCEPTION 'Manager access required' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180 OR length(coalesce(p_details,''))>1500
  OR (p_assigned IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=p_assigned))
 THEN RAISE EXCEPTION 'Please check task details'; END IF;
 INSERT INTO public.business_tasks(business_id,title,details,assigned_to,created_by,due_on)
 VALUES(p_business,btrim(p_title),btrim(coalesce(p_details,'')),p_assigned,auth.uid(),p_due_on) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
CREATE FUNCTION public.business_set_task_completed(p_business uuid,p_task uuid,p_completed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_task public.business_tasks%ROWTYPE;v_role public.member_role;
BEGIN
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_task FROM public.business_tasks WHERE business_id=p_business AND id=p_task FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task unavailable'; END IF;
 IF v_role NOT IN ('owner','manager') AND coalesce(v_task.assigned_to,v_task.created_by)<>auth.uid()
 THEN RAISE EXCEPTION 'Task access denied' USING ERRCODE='42501'; END IF;
 UPDATE public.business_tasks SET completed_at=CASE WHEN p_completed THEN now() ELSE NULL END,updated_at=now()
 WHERE id=p_task AND business_id=p_business;
END;$$;
REVOKE ALL ON FUNCTION public.business_save_task(uuid,text,text,uuid,date), public.business_set_task_completed(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_save_task(uuid,text,text,uuid,date), public.business_set_task_completed(uuid,uuid,boolean) TO authenticated;

-- Public contact details are explicitly provided for directory visitors.
-- The business login/owner email must never be published merely because a listing is enabled.
ALTER TABLE public.businesses ADD COLUMN directory_email text;
ALTER TABLE public.businesses ADD COLUMN directory_phone text;
ALTER TABLE public.businesses ADD COLUMN directory_whatsapp text;
-- Public REST access to businesses used to expose owner/account contact fields.
-- Replace broad published-row RLS with member/admin-only reads. Public directory RPCs below
-- expose a strict, opt-in projection and never expose the private business login email.
DROP POLICY IF EXISTS business_member_read ON public.businesses;
CREATE POLICY business_member_read ON public.businesses FOR SELECT TO anon,authenticated
 USING(public.is_business_member(id) OR EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=auth.uid() AND a.active));
CREATE FUNCTION public.public_directory_list() RETURNS TABLE (
 id uuid,slug text,name text,category text,description text,logo_url text,city text,state text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT b.id,b.slug,b.name,b.category,b.description,b.logo_url,b.city,b.state
 FROM public.businesses b WHERE b.verified=true AND b.published=true
 ORDER BY b.name LIMIT 72;
$$;
CREATE FUNCTION public.public_directory_profile(p_slug text) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT to_jsonb(d) FROM (
  SELECT b.name,b.category,b.description,b.logo_url,b.city,b.state,
  b.directory_email,b.directory_phone,b.directory_whatsapp
  FROM public.businesses b WHERE b.slug=p_slug AND b.verified=true AND b.published=true LIMIT 1
 ) d;
$$;
REVOKE ALL ON FUNCTION public.public_directory_list(),public.public_directory_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_directory_list(),public.public_directory_profile(text) TO anon,authenticated;

-- Protect business verification and featured status against owner-side updates.
CREATE FUNCTION public.prevent_self_verification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF (OLD.verified IS DISTINCT FROM NEW.verified OR OLD.featured IS DISTINCT FROM NEW.featured)
  AND current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
  AND NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active)
 THEN RAISE EXCEPTION 'Only platform verification can update verified or featured status' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER business_verification_protected BEFORE UPDATE OF verified,featured ON public.businesses
 FOR EACH ROW EXECUTE FUNCTION public.prevent_self_verification();
REVOKE ALL ON FUNCTION public.prevent_self_verification() FROM PUBLIC,anon,authenticated;

-- Public listing verification is controlled by the platform; normal business access is instant and unaffected.
CREATE FUNCTION public.admin_verify_business_listing(p_business uuid,p_verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active)
 THEN RAISE EXCEPTION 'Platform verification access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business) THEN RAISE EXCEPTION 'Business not found'; END IF;
 UPDATE public.businesses SET verified=p_verified,updated_at=now(),published=false
 WHERE id=p_business;
END;$$;
REVOKE ALL ON FUNCTION public.admin_verify_business_listing(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_business_listing(uuid,boolean) TO authenticated;

-- Logo bucket: publicly shown logos only, with owner-only business-scoped writes.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('business-logos','business-logos',true,2097152,ARRAY['image/png','image/jpeg','image/webp'])
 ON CONFLICT(id) DO NOTHING;
CREATE POLICY business_logo_owner_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='business-logos' AND EXISTS(
 SELECT 1 FROM public.business_members m WHERE m.user_id=auth.uid() AND m.role='owner'
  AND (m.business_id::text)=split_part(name,'/',1)));
CREATE POLICY business_logo_owner_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='business-logos' AND EXISTS(
 SELECT 1 FROM public.business_members m WHERE m.user_id=auth.uid() AND m.role='owner'
  AND (m.business_id::text)=split_part(name,'/',1)));
COMMIT;
