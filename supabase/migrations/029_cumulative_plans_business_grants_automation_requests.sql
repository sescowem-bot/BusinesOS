-- Phase 030C | Additive cumulative plans, time-limited business grants and automation requests.
-- Requires 016,017,019,020,023. Does not alter existing plan assignments or enable email sends.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.public_site_plans') IS NULL
 OR to_regclass('public.platform_plan_features') IS NULL
 OR to_regclass('public.platform_plan_role_features') IS NULL
 OR to_regclass('public.business_plan_assignments') IS NULL
 OR to_regclass('public.user_notifications') IS NULL
 OR to_regclass('public.business_members') IS NULL THEN
  RAISE EXCEPTION 'Required migrations 016-023 are missing; do not install 029';
 END IF;
END $$;

-- Plans may inherit ONE lower plan. Inheritance is additive; no existing entitlements are removed.
CREATE TABLE public.plan_parent_links (
 plan_id text PRIMARY KEY REFERENCES public.public_site_plans(id) ON DELETE CASCADE,
 parent_plan_id text NOT NULL REFERENCES public.public_site_plans(id) ON DELETE RESTRICT,
 updated_by uuid REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT plan_not_own_parent CHECK(plan_id<>parent_plan_id)
);
ALTER TABLE public.plan_parent_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_parent_links FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.plan_parent_links TO authenticated;
CREATE POLICY plan_parent_admin_read ON public.plan_parent_links FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active));

CREATE FUNCTION public.admin_set_plan_parent(p_plan_id text,p_parent_plan_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_current text;v_depth integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
  RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id=p_plan_id) THEN RAISE EXCEPTION 'Unknown plan'; END IF;
 IF p_parent_plan_id IS NULL OR p_parent_plan_id='' THEN
  DELETE FROM public.plan_parent_links WHERE plan_id=p_plan_id; RETURN;
 END IF;
 IF p_plan_id=p_parent_plan_id OR NOT EXISTS(SELECT 1 FROM public.public_site_plans WHERE id=p_parent_plan_id) THEN
  RAISE EXCEPTION 'Invalid parent plan'; END IF;
 -- Serialize competing hierarchy edits so two concurrent requests cannot create a cycle.
 LOCK TABLE public.plan_parent_links IN SHARE ROW EXCLUSIVE MODE;
 v_current:=p_parent_plan_id;
 WHILE v_current IS NOT NULL LOOP
  IF v_current=p_plan_id THEN RAISE EXCEPTION 'Circular subscription plan inheritance is not allowed'; END IF;
  v_depth:=v_depth+1;
  IF v_depth>32 THEN RAISE EXCEPTION 'Plan hierarchy is too deep'; END IF;
  SELECT parent_plan_id INTO v_current FROM public.plan_parent_links WHERE plan_id=v_current;
 END LOOP;
 INSERT INTO public.plan_parent_links(plan_id,parent_plan_id,updated_by)
 VALUES(p_plan_id,p_parent_plan_id,auth.uid())
 ON CONFLICT(plan_id) DO UPDATE SET parent_plan_id=EXCLUDED.parent_plan_id,updated_by=EXCLUDED.updated_by,updated_at=now();
END;$$;
REVOKE ALL ON FUNCTION public.admin_set_plan_parent(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_parent(text,text) TO authenticated;

-- A business-specific grant supplements its approved subscription. A disabled grant NEVER
-- takes away a feature already included in the business plan.
CREATE TABLE public.business_feature_grants (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 feature_key text NOT NULL CHECK(feature_key IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team')),
 enabled boolean NOT NULL DEFAULT true,
 allowed_roles public.member_role[] NOT NULL DEFAULT ARRAY['owner']::public.member_role[],
 expires_at timestamptz,
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=1000),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,feature_key),
 CHECK(array_length(allowed_roles,1) BETWEEN 1 AND 6)
);
ALTER TABLE public.business_feature_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_feature_grants FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_feature_grants TO authenticated;
CREATE POLICY feature_grants_visible_to_owner_admin ON public.business_feature_grants FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.platform_admins p WHERE p.user_id=auth.uid() AND p.active)
 OR EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_feature_grants.business_id AND m.user_id=auth.uid() AND m.role='owner'));
CREATE TABLE public.business_feature_grant_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 feature_key text NOT NULL,
 before_value jsonb,
 after_value jsonb NOT NULL,
 changed_by uuid NOT NULL REFERENCES auth.users(id),
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feature_grant_audit_business_idx ON public.business_feature_grant_audit(business_id,changed_at DESC);
ALTER TABLE public.business_feature_grant_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_feature_grant_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_feature_grant_audit TO authenticated;
CREATE POLICY feature_grant_audit_admin_read ON public.business_feature_grant_audit FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.platform_admins p WHERE p.user_id=auth.uid() AND p.active));

CREATE FUNCTION public.admin_set_business_feature_grant(
 p_business uuid,p_feature text,p_enabled boolean,p_roles text[],p_expires_at timestamptz,p_note text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_prev jsonb;v_next jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
  RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business) THEN RAISE EXCEPTION 'Business not found'; END IF;
 IF p_feature NOT IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team') THEN RAISE EXCEPTION 'Unknown feature'; END IF;
 IF p_roles IS NULL OR cardinality(p_roles) NOT BETWEEN 1 AND 6 OR NOT ('owner'=ANY(p_roles))
 OR EXISTS(SELECT 1 FROM unnest(p_roles) r WHERE r IS NULL OR r NOT IN ('owner','manager','finance','sales','inventory','staff'))
 THEN RAISE EXCEPTION 'Select valid business roles including Owner'; END IF;
 IF p_note IS NULL OR length(p_note)>1000 THEN RAISE EXCEPTION 'Invalid change note'; END IF;
 IF p_enabled AND p_expires_at IS NOT NULL AND p_expires_at<=now() THEN RAISE EXCEPTION 'Grant expiration must be in the future'; END IF;
 SELECT to_jsonb(g) INTO v_prev FROM public.business_feature_grants g WHERE business_id=p_business AND feature_key=p_feature FOR UPDATE;
 INSERT INTO public.business_feature_grants(business_id,feature_key,enabled,allowed_roles,expires_at,note,updated_by)
 VALUES(p_business,p_feature,p_enabled,p_roles::public.member_role[],p_expires_at,p_note,auth.uid())
 ON CONFLICT(business_id,feature_key) DO UPDATE SET enabled=EXCLUDED.enabled,allowed_roles=EXCLUDED.allowed_roles,
 expires_at=EXCLUDED.expires_at,note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=now();
 SELECT to_jsonb(g) INTO v_next FROM public.business_feature_grants g WHERE business_id=p_business AND feature_key=p_feature;
 INSERT INTO public.business_feature_grant_audit(business_id,feature_key,before_value,after_value,changed_by)
 VALUES(p_business,p_feature,v_prev,v_next,auth.uid());
END;$$;
REVOKE ALL ON FUNCTION public.admin_set_business_feature_grant(uuid,text,boolean,text[],timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_business_feature_grant(uuid,text,boolean,text[],timestamptz,text) TO authenticated;

-- The database is the source of truth for plan inheritance + role permissions + business extras.
CREATE OR REPLACE FUNCTION public.business_has_feature(p_business_id uuid,p_feature_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_plan text;v_role public.member_role;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business_id AND user_id=auth.uid();
 IF v_role IS NULL THEN RETURN false; END IF;
 IF p_feature_key IN ('dashboard','customers','orders','payments','expenses','products','settings','upgrade') THEN RETURN true; END IF;
 IF p_feature_key NOT IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team') THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.business_feature_grants g WHERE g.business_id=p_business_id AND g.feature_key=p_feature_key
  AND g.enabled AND (g.expires_at IS NULL OR g.expires_at>now()) AND v_role=ANY(g.allowed_roles)) THEN RETURN true; END IF;
 SELECT plan_id INTO v_plan FROM public.business_plan_assignments WHERE business_id=p_business_id;
 IF v_plan IS NULL THEN RETURN false; END IF;
 RETURN EXISTS (
  WITH RECURSIVE family(plan_id,depth) AS (
    SELECT v_plan,0 UNION ALL
    SELECT parent.parent_plan_id,f.depth+1 FROM family f JOIN public.plan_parent_links parent ON parent.plan_id=f.plan_id WHERE f.depth<32
  )
  SELECT 1 FROM family f JOIN public.platform_plan_features pf ON pf.plan_id=f.plan_id
  WHERE pf.feature_key=p_feature_key AND pf.enabled AND (
    v_role='owner'
    OR EXISTS(SELECT 1 FROM public.platform_plan_role_features pr WHERE pr.plan_id=f.plan_id
      AND pr.feature_key=p_feature_key AND pr.role=v_role AND pr.enabled)
    OR (NOT EXISTS(SELECT 1 FROM public.platform_plan_role_features pr WHERE pr.plan_id=f.plan_id
      AND pr.feature_key=p_feature_key AND pr.role=v_role)
      AND CASE p_feature_key
        WHEN 'accounting' THEN v_role IN ('manager','finance')
        WHEN 'tax' THEN v_role IN ('manager','finance')
        WHEN 'financial_reports' THEN v_role IN ('manager','finance')
        WHEN 'communications' THEN v_role IN ('manager','sales')
        WHEN 'campaigns' THEN v_role='manager'
        WHEN 'inventory' THEN v_role IN ('manager','inventory')
        WHEN 'insights' THEN v_role IN ('manager','finance')
        WHEN 'growth' THEN v_role='manager'
        ELSE false END)
  ) LIMIT 1
 );
END;$$;
REVOKE ALL ON FUNCTION public.business_has_feature(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_has_feature(uuid,text) TO authenticated;

-- Include inherited feature names when showing public pricing, not individual business extras.
CREATE OR REPLACE FUNCTION public.published_plan_features()
RETURNS TABLE(plan_id text,feature_key text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH RECURSIVE family(child,ancestor,depth) AS (
  SELECT p.id,p.id,0 FROM public.public_site_plans p WHERE p.published=true
  UNION ALL
  SELECT f.child,pp.parent_plan_id,f.depth+1 FROM family f
  JOIN public.plan_parent_links pp ON pp.plan_id=f.ancestor WHERE f.depth<32
 )
 SELECT DISTINCT f.child,pf.feature_key FROM family f
 JOIN public.platform_plan_features pf ON pf.plan_id=f.ancestor AND pf.enabled
 ORDER BY f.child,pf.feature_key;
$$;
REVOKE ALL ON FUNCTION public.published_plan_features() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.published_plan_features() TO anon,authenticated;

-- Requests for custom automation are commercial service enquiries, not runnable jobs.
CREATE TABLE public.business_automation_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 category text NOT NULL CHECK(category IN ('task_reminders','payment_reminders','inventory_alerts','scheduled_reports','custom')),
 title text NOT NULL CHECK(char_length(title) BETWEEN 5 AND 160),
 details text NOT NULL CHECK(char_length(details) BETWEEN 20 AND 3000),
 delivery_channel text NOT NULL DEFAULT 'in_app' CHECK(delivery_channel IN ('in_app','email')),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','quoted','accepted','configured','declined','cancelled')),
 quote_note text NOT NULL DEFAULT '' CHECK(char_length(quote_note)<=1500),
 admin_note text NOT NULL DEFAULT '' CHECK(char_length(admin_note)<=1500),
 reviewed_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_requests_business_idx ON public.business_automation_requests(business_id,created_at DESC);
ALTER TABLE public.business_automation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_automation_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_automation_requests TO authenticated;
CREATE POLICY automation_request_read ON public.business_automation_requests FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.platform_admins p WHERE p.user_id=auth.uid() AND p.active)
 OR EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_automation_requests.business_id AND m.user_id=auth.uid() AND m.role='owner')
);
CREATE TABLE public.business_automation_request_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES public.business_automation_requests(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 event_type text NOT NULL,
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_automation_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_automation_request_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_automation_request_events TO authenticated;
CREATE POLICY automation_events_admin_only ON public.business_automation_request_events FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.platform_admins p WHERE p.user_id=auth.uid() AND p.active));

CREATE FUNCTION public.request_business_automation(p_business uuid,p_category text,p_title text,p_details text,p_channel text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members m WHERE m.user_id=auth.uid() AND m.business_id=p_business AND m.role='owner')
 THEN RAISE EXCEPTION 'Business owner access required' USING ERRCODE='42501'; END IF;
 IF p_category NOT IN ('task_reminders','payment_reminders','inventory_alerts','scheduled_reports','custom')
 OR p_channel NOT IN ('in_app','email') OR length(trim(coalesce(p_title,''))) NOT BETWEEN 5 AND 160
 OR length(trim(coalesce(p_details,''))) NOT BETWEEN 20 AND 3000 THEN RAISE EXCEPTION 'Invalid automation request'; END IF;
 INSERT INTO public.business_automation_requests(business_id,requested_by,category,title,details,delivery_channel)
 VALUES(p_business,auth.uid(),p_category,trim(p_title),trim(p_details),p_channel) RETURNING id INTO v_id;
 INSERT INTO public.business_automation_request_events(request_id,actor_id,event_type) VALUES(v_id,auth.uid(),'requested');
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.request_business_automation(uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_business_automation(uuid,text,text,text,text) TO authenticated;

CREATE FUNCTION public.admin_review_automation_request(p_id uuid,p_action text,p_quote_note text,p_admin_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_request public.business_automation_requests%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins p WHERE p.user_id=auth.uid() AND p.active)
 THEN RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_request FROM public.business_automation_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Automation request not found'; END IF;
 IF p_quote_note IS NULL OR length(p_quote_note)>1500 OR p_admin_note IS NULL OR length(p_admin_note)>1500 THEN RAISE EXCEPTION 'Notes too long'; END IF;
 IF (p_action='quote' AND v_request.status='requested' AND length(trim(p_quote_note))>=5) THEN
  UPDATE public.business_automation_requests SET status='quoted',quote_note=trim(p_quote_note),admin_note=trim(p_admin_note),reviewed_by=auth.uid(),updated_at=now() WHERE id=p_id;
 ELSIF p_action='decline' AND v_request.status IN ('requested','quoted') THEN
  UPDATE public.business_automation_requests SET status='declined',admin_note=trim(p_admin_note),reviewed_by=auth.uid(),updated_at=now() WHERE id=p_id;
 ELSIF p_action='configured' AND v_request.status='accepted' THEN
  UPDATE public.business_automation_requests SET status='configured',admin_note=trim(p_admin_note),reviewed_by=auth.uid(),updated_at=now() WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid request state transition'; END IF;
 INSERT INTO public.business_automation_request_events(request_id,actor_id,event_type,note)
 VALUES(p_id,auth.uid(),p_action,left(trim(p_admin_note),500));
END;$$;
REVOKE ALL ON FUNCTION public.admin_review_automation_request(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_automation_request(uuid,text,text,text) TO authenticated;

CREATE FUNCTION public.respond_automation_quote(p_id uuid,p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_request public.business_automation_requests%ROWTYPE;
BEGIN
 SELECT * INTO v_request FROM public.business_automation_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members m
  WHERE m.user_id=auth.uid() AND m.business_id=v_request.business_id AND m.role='owner')
 THEN RAISE EXCEPTION 'Business owner access required' USING ERRCODE='42501'; END IF;
 IF v_request.status<>'quoted' THEN RAISE EXCEPTION 'Quote is not awaiting response'; END IF;
 UPDATE public.business_automation_requests SET status=CASE WHEN p_accept THEN 'accepted' ELSE 'cancelled' END,updated_at=now() WHERE id=p_id;
 INSERT INTO public.business_automation_request_events(request_id,actor_id,event_type) VALUES(p_id,auth.uid(),CASE WHEN p_accept THEN 'accepted' ELSE 'cancelled' END);
END;$$;
REVOKE ALL ON FUNCTION public.respond_automation_quote(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_automation_quote(uuid,boolean) TO authenticated;

-- In-app alerts are transactional; no Resend or paid sending is activated by this migration.
CREATE FUNCTION public.notify_automation_request_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user record;v_target text;
BEGIN
 IF TG_OP='INSERT' THEN
  FOR v_user IN SELECT user_id FROM public.platform_admins WHERE active LOOP
   INSERT INTO public.user_notifications(recipient_id,business_id,category,title,body,action_url,priority,idempotency_key)
   VALUES(v_user.user_id,NEW.business_id,'business','New automation request',left(NEW.title,160),'/admin/automations','normal','automation:new:'||NEW.id)
   ON CONFLICT DO NOTHING;
  END LOOP;
 ELSIF TG_OP='UPDATE' AND OLD.status<>NEW.status THEN
  IF NEW.status IN ('quoted','declined','configured') THEN
   INSERT INTO public.user_notifications(recipient_id,business_id,category,title,body,action_url,priority,idempotency_key)
   VALUES(NEW.requested_by,NEW.business_id,'business','Automation request updated',left(NEW.title||': '||NEW.status,200),'/automations/requests','normal','automation:status:'||NEW.id||':'||NEW.status)
   ON CONFLICT DO NOTHING;
  ELSIF NEW.status IN ('accepted','cancelled') THEN
   FOR v_user IN SELECT user_id FROM public.platform_admins WHERE active LOOP
    INSERT INTO public.user_notifications(recipient_id,business_id,category,title,body,action_url,priority,idempotency_key)
    VALUES(v_user.user_id,NEW.business_id,'business','Automation quotation response',left(NEW.title||': '||NEW.status,200),'/admin/automations','normal','automation:status:'||NEW.id||':'||NEW.status)
    ON CONFLICT DO NOTHING;
   END LOOP;
  END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.notify_automation_request_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_automation_request_notifications AFTER INSERT OR UPDATE OF status ON public.business_automation_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_automation_request_change();
COMMIT;
