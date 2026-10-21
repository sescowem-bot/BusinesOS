-- SESCO Business App / BusinessOS — Stage 061 (STAGING ONLY)
-- Registered business and member lifecycle: reversible suspension, archival,
-- per-business staff removal, administrator edits and private audit history.
-- Requires the schema through 056 and 046. DO NOT run in production without
-- inspecting ALL tenant RPCs and RLS policies for direct business_members checks.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_members') IS NULL
 OR to_regclass('public.businesses') IS NULL
 OR to_regclass('public.business_member_labels') IS NULL
 OR to_regclass('public.platform_admins') IS NULL
 OR to_regprocedure('public.is_business_member(uuid)') IS NULL
 OR to_regprocedure('public.is_business_owner(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Missing baseline membership, admin or role schema. Stop before changing anything.';
 END IF;
 IF to_regclass('public.business_lifecycle_state') IS NOT NULL OR
    to_regclass('public.business_member_access') IS NOT NULL THEN
  RAISE EXCEPTION 'Stage 061 has already been applied or is partially installed. Reconcile manually.';
 END IF;
END $$;

CREATE TABLE public.business_lifecycle_state (
 business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','archived')),
 reason text NOT NULL DEFAULT '', changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.business_member_access (
 business_id uuid NOT NULL,
 user_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','removed')),
 reason text NOT NULL DEFAULT '', changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,user_id),
 FOREIGN KEY(business_id,user_id) REFERENCES public.business_members(business_id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.platform_account_lifecycle_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_id uuid NOT NULL,
 member_user_id uuid,
 action text NOT NULL,
 previous_status text,
 new_status text,
 actor_id uuid,
 reason text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_account_lifecycle_recent ON public.platform_account_lifecycle_audit(changed_at DESC);
CREATE INDEX platform_account_lifecycle_business ON public.platform_account_lifecycle_audit(business_id,changed_at DESC);
ALTER TABLE public.business_lifecycle_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_member_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_account_lifecycle_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_lifecycle_state,public.business_member_access,public.platform_account_lifecycle_audit FROM PUBLIC,anon,authenticated;
-- They are not exposed as ordinary client-managed tables. Only vetted RPCs below may write.

CREATE FUNCTION public.business_membership_is_active(p_business uuid,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.business_members m
  WHERE m.business_id=p_business AND m.user_id=p_user
    AND NOT EXISTS (SELECT 1 FROM public.business_lifecycle_state s
     WHERE s.business_id=m.business_id AND s.status<>'active')
    AND NOT EXISTS (SELECT 1 FROM public.business_member_access a
     WHERE a.business_id=m.business_id AND a.user_id=m.user_id AND a.status<>'active')
 );
$$;
REVOKE ALL ON FUNCTION public.business_membership_is_active(uuid,uuid) FROM PUBLIC,anon,authenticated;
-- Important: replaces the two existing central membership helpers. This does
-- NOT automatically cover older SECURITY DEFINER RPCs that query business_members
-- directly. The release must remain STAGING-ONLY until that audit passes.
CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND public.business_membership_is_active(p_business_id,auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL
  AND public.business_membership_is_active(p_business_id,auth.uid())
  AND EXISTS (SELECT 1 FROM public.business_members m
   WHERE m.business_id=p_business_id AND m.user_id=auth.uid() AND m.role='owner');
$$;

-- Hide disabled personal membership rows from normal invoker queries, including
-- direct RLS EXISTS(...) membership checks. Definer RPCs still require audit.
CREATE POLICY businessos_member_access_read_gate
 ON public.business_members AS RESTRICTIVE FOR SELECT TO authenticated
 USING (user_id<>auth.uid() OR public.is_business_member(business_id));

CREATE FUNCTION public.my_business_access_state(p_business_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_business text;v_member text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.business_members
  WHERE business_id=p_business_id AND user_id=auth.uid()) THEN RETURN 'not_member'; END IF;
 SELECT status INTO v_business FROM public.business_lifecycle_state WHERE business_id=p_business_id;
 SELECT status INTO v_member FROM public.business_member_access
  WHERE business_id=p_business_id AND user_id=auth.uid();
 IF v_business='archived' THEN RETURN 'business_archived'; END IF;
 IF v_business='suspended' THEN RETURN 'business_suspended'; END IF;
 IF v_member='removed' THEN RETURN 'member_removed'; END IF;
 IF v_member='suspended' THEN RETURN 'member_suspended'; END IF;
 RETURN 'active';
END;$$;
REVOKE ALL ON FUNCTION public.my_business_access_state(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.my_business_access_state(uuid) TO authenticated;
CREATE FUNCTION public.my_blocked_membership_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.business_members m WHERE m.user_id=auth.uid()
 AND NOT public.business_membership_is_active(m.business_id,m.user_id));
$$;
REVOKE ALL ON FUNCTION public.my_blocked_membership_exists() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.my_blocked_membership_exists() TO authenticated;

CREATE FUNCTION public.platform_business_lifecycle_snapshot(p_business_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.platform_admins
  WHERE user_id=auth.uid() AND active) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id=p_business_id) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object(
  'status',coalesce((SELECT status FROM public.business_lifecycle_state WHERE business_id=p_business_id),'active'),
  'members',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',m.user_id,
   'status',coalesce(a.status,'active'),'role',m.role) ORDER BY m.created_at)
    FROM public.business_members m LEFT JOIN public.business_member_access a
    ON a.business_id=m.business_id AND a.user_id=m.user_id
    WHERE m.business_id=p_business_id),'[]'::jsonb),
  'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,
   'member_user_id',e.member_user_id,'changed_at',e.changed_at,'reason',e.reason)
   ORDER BY e.changed_at DESC) FROM (SELECT * FROM public.platform_account_lifecycle_audit
    WHERE business_id=p_business_id ORDER BY changed_at DESC LIMIT 25) e),'[]'::jsonb)
 );
END;$$;
REVOKE ALL ON FUNCTION public.platform_business_lifecycle_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_business_lifecycle_snapshot(uuid) TO authenticated;

CREATE FUNCTION public.platform_business_lifecycle_list()
RETURNS TABLE (business_id uuid,status text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.platform_admins
  WHERE user_id=auth.uid() AND active) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT b.id,coalesce(s.status,'active') FROM public.businesses b
 LEFT JOIN public.business_lifecycle_state s ON s.business_id=b.id;
END;$$;
REVOKE ALL ON FUNCTION public.platform_business_lifecycle_list() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_business_lifecycle_list() TO authenticated;

CREATE FUNCTION public.platform_manage_business_lifecycle(
 p_business uuid,p_action text,p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old text;v_next text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active)
 THEN RAISE EXCEPTION 'Platform administrator only' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN('suspend','restore','archive') OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500
 THEN RAISE EXCEPTION 'Choose a valid action and give a reason (8-500 characters)' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business FOR UPDATE) THEN
  RAISE EXCEPTION 'Business not found' USING ERRCODE='22023'; END IF;
 SELECT status INTO v_old FROM public.business_lifecycle_state WHERE business_id=p_business FOR UPDATE;
 v_old:=coalesce(v_old,'active');
 v_next:=CASE p_action WHEN 'suspend' THEN 'suspended' WHEN 'archive' THEN 'archived' ELSE 'active' END;
 IF v_old=v_next THEN RAISE EXCEPTION 'Business already has that status' USING ERRCODE='22023'; END IF;
 INSERT INTO public.business_lifecycle_state(business_id,status,reason,changed_by,changed_at)
 VALUES(p_business,v_next,btrim(p_reason),auth.uid(),now())
 ON CONFLICT(business_id) DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,
  changed_by=EXCLUDED.changed_by,changed_at=now();
 IF v_next<>'active' THEN UPDATE public.businesses SET published=false WHERE id=p_business; END IF;
 INSERT INTO public.platform_account_lifecycle_audit(business_id,action,previous_status,new_status,actor_id,reason)
 VALUES(p_business,'business_'||p_action,v_old,v_next,auth.uid(),btrim(p_reason));
END;$$;
REVOKE ALL ON FUNCTION public.platform_manage_business_lifecycle(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_manage_business_lifecycle(uuid,text,text) TO authenticated;

CREATE FUNCTION public.platform_edit_registered_business(
 p_business uuid,p_name text,p_category text,p_email text,p_phone text,p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active)
 THEN RAISE EXCEPTION 'Platform administrator only' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120
 OR length(btrim(coalesce(p_category,''))) NOT BETWEEN 2 AND 120
 OR length(coalesce(p_phone,''))>40 OR length(coalesce(p_email,''))>250
 OR (coalesce(p_email,'')<>'' AND p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
 OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500
 THEN RAISE EXCEPTION 'Invalid business profile or explanation' USING ERRCODE='22023'; END IF;
 UPDATE public.businesses SET name=btrim(p_name),category=btrim(p_category),email=btrim(p_email),phone=btrim(p_phone)
 WHERE id=p_business;
 IF NOT FOUND THEN RAISE EXCEPTION 'Business not found' USING ERRCODE='22023'; END IF;
 INSERT INTO public.platform_account_lifecycle_audit(business_id,action,actor_id,reason)
 VALUES(p_business,'business_profile_edited',auth.uid(),btrim(p_reason));
END;$$;
REVOKE ALL ON FUNCTION public.platform_edit_registered_business(uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_edit_registered_business(uuid,text,text,text,text,text) TO authenticated;

-- Business owner can review staff access without receiving platform audit records.
CREATE FUNCTION public.business_staff_access_list(p_business uuid)
RETURNS TABLE(user_id uuid,status text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_business_owner(p_business) OR
  EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active))
 THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT m.user_id,coalesce(a.status,'active') FROM public.business_members m
 LEFT JOIN public.business_member_access a ON a.business_id=m.business_id AND a.user_id=m.user_id
 WHERE m.business_id=p_business;
END;$$;
REVOKE ALL ON FUNCTION public.business_staff_access_list(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.business_staff_access_list(uuid) TO authenticated;

CREATE FUNCTION public.business_manage_staff_access(
 p_business uuid,p_member uuid,p_action text,p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_admin boolean;v_role text;v_old text;v_next text;
BEGIN
 v_admin:=EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active);
 IF auth.uid() IS NULL OR NOT (v_admin OR public.is_business_owner(p_business))
 THEN RAISE EXCEPTION 'Business owner or platform administrator only' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('suspend','restore','remove') OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500
 THEN RAISE EXCEPTION 'Choose an action and a reason (8-500 characters)' USING ERRCODE='22023'; END IF;
 IF p_member=auth.uid() THEN RAISE EXCEPTION 'You cannot remove your own access' USING ERRCODE='42501'; END IF;
 SELECT role::text INTO v_role FROM public.business_members
 WHERE business_id=p_business AND user_id=p_member FOR UPDATE;
 IF v_role IS NULL THEN RAISE EXCEPTION 'Business member not found' USING ERRCODE='22023'; END IF;
 IF v_role='owner' THEN RAISE EXCEPTION 'Business ownership cannot be removed from staff controls' USING ERRCODE='42501'; END IF;
 IF NOT v_admin AND NOT public.is_business_owner(p_business) THEN
  RAISE EXCEPTION 'Business access has changed' USING ERRCODE='42501'; END IF;
 SELECT status INTO v_old FROM public.business_member_access
 WHERE business_id=p_business AND user_id=p_member FOR UPDATE;
 v_old:=coalesce(v_old,'active');
 v_next:=CASE p_action WHEN 'suspend' THEN 'suspended' WHEN 'remove' THEN 'removed' ELSE 'active' END;
 IF v_old=v_next THEN RAISE EXCEPTION 'Staff member is already in that state' USING ERRCODE='22023'; END IF;
 INSERT INTO public.business_member_access(business_id,user_id,status,reason,changed_by,changed_at)
 VALUES(p_business,p_member,v_next,btrim(p_reason),auth.uid(),now())
 ON CONFLICT(business_id,user_id) DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,
 changed_by=EXCLUDED.changed_by,changed_at=now();
 INSERT INTO public.platform_account_lifecycle_audit(business_id,member_user_id,action,previous_status,new_status,actor_id,reason)
 VALUES(p_business,p_member,'member_'||p_action,v_old,v_next,auth.uid(),btrim(p_reason));
END;$$;
REVOKE ALL ON FUNCTION public.business_manage_staff_access(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.business_manage_staff_access(uuid,uuid,text,text) TO authenticated;

CREATE FUNCTION public.platform_edit_registered_member(
 p_business uuid,p_member uuid,p_alias text,p_role text,p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active)
 THEN RAISE EXCEPTION 'Platform administrator only' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_alias,''))) NOT BETWEEN 2 AND 100
 OR p_role NOT IN ('manager','sales','inventory','finance','staff')
 OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500
 THEN RAISE EXCEPTION 'Choose a permitted staff role, display name and explanation' USING ERRCODE='22023'; END IF;
 SELECT role::text INTO v_old FROM public.business_members
 WHERE business_id=p_business AND user_id=p_member FOR UPDATE;
 IF v_old IS NULL THEN RAISE EXCEPTION 'Member not found' USING ERRCODE='22023'; END IF;
 IF v_old='owner' THEN RAISE EXCEPTION 'Ownership cannot be reassigned here' USING ERRCODE='42501'; END IF;
 UPDATE public.business_members SET role=p_role::public.member_role
 WHERE business_id=p_business AND user_id=p_member;
 INSERT INTO public.business_member_labels(business_id,user_id,display_name,changed_by,updated_at)
 VALUES(p_business,p_member,btrim(p_alias),auth.uid(),now())
 ON CONFLICT(business_id,user_id) DO UPDATE SET display_name=EXCLUDED.display_name,
 changed_by=EXCLUDED.changed_by,updated_at=now();
 INSERT INTO public.platform_account_lifecycle_audit(business_id,member_user_id,action,previous_status,new_status,actor_id,reason)
 VALUES(p_business,p_member,'member_details_edited',v_old,p_role,auth.uid(),btrim(p_reason));
END;$$;
REVOKE ALL ON FUNCTION public.platform_edit_registered_member(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_edit_registered_member(uuid,uuid,text,text,text) TO authenticated;
COMMIT;
