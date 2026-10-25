-- Phase1D extra administrative, invitations and campaign workflow permission checks.
BEGIN;
CREATE OR REPLACE FUNCTION public.business_manage_staff_access(p_business uuid, p_member uuid, p_action text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin boolean;v_role text;v_old text;v_next text;
BEGIN
 v_admin:=EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active);
 IF NOT v_admin AND (NOT public.business_plan_core_feature_allowed(p_business,'settings') OR NOT public.business_can_perform_action(p_business,'settings','edit')) THEN RAISE EXCEPTION 'Staff access changes not permitted' USING ERRCODE='42501'; END IF;
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
END;$function$;

CREATE OR REPLACE FUNCTION public.business_staff_access_list(p_business uuid)
 RETURNS TABLE(user_id uuid, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) AND (NOT public.business_plan_core_feature_allowed(p_business,'settings') OR NOT public.business_can_perform_action(p_business,'settings','view')) THEN RAISE EXCEPTION 'Staff access view denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT (public.is_business_owner(p_business) OR
  EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active))
 THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT m.user_id,coalesce(a.status,'active') FROM public.business_members m
 LEFT JOIN public.business_member_access a ON a.business_id=m.business_id AND a.user_id=m.user_id
 WHERE m.business_id=p_business;
END;$function$;

CREATE OR REPLACE FUNCTION public.create_team_invitation(p_business_id uuid, p_email text, p_role member_role)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid; v_email citext;
begin
 if not public.business_plan_core_feature_allowed(p_business_id,'settings') or not public.business_can_perform_action(p_business_id,'settings','create') then raise exception 'Invitation permission denied' using errcode='42501'; end if;
 
 if not public.is_business_owner(p_business_id) then raise exception 'Only owners can invite';end if;
 v_email:=lower(trim(p_email))::citext;
 if length(v_email)>254 or v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email';end if;
 if p_role='owner' then raise exception 'Owner invitation prohibited';end if;
 insert into public.business_team_invitations(business_id,email,role,invited_by)
 values(p_business_id,v_email,p_role,auth.uid()) returning id into v_id;
 return v_id;
end;$function$;

CREATE OR REPLACE FUNCTION public.engagement_preview_campaign(p_campaign uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_business uuid;v_channel text;v_segment text;v_count integer;
begin
 select c.business_id,c.channel,s.filter_kind into v_business,v_channel,v_segment
 from public.engagement_campaigns c join public.contact_segments s on s.id=c.segment_id and s.business_id=c.business_id
 where c.id=p_campaign and c.status in ('draft','scheduled');
 if v_business is null then raise exception 'Campaign unavailable';end if;
 if auth.uid() is null or not public.is_business_owner(v_business) then raise exception 'Not authorised';end if;
 if not public.business_has_feature(v_business,'campaigns') or not public.business_can_perform_action(v_business,'campaigns','create') then raise exception 'Campaign permission denied' using errcode='42501';end if;
 -- Only business-linked contacts. No actual message delivery and no external API call.
 insert into public.engagement_message_queue(business_id,campaign_id,customer_id,channel,recipient)
 select v_business,p_campaign,bc.customer_id,v_channel,
 case when v_channel='email' then trim(cu.email) else trim(cu.phone) end
 from public.business_customers bc join public.customers cu on cu.id=bc.customer_id
 where bc.business_id=v_business
 and (v_segment='all' or (v_segment='with_email' and cu.email is not null) or (v_segment='with_phone' and cu.phone is not null))
 and case when v_channel='email' then nullif(trim(coalesce(cu.email,'')),'') is not null else nullif(trim(coalesce(cu.phone,'')),'') is not null end
 on conflict (campaign_id,customer_id) do nothing;
 select count(*) into v_count from public.engagement_message_queue where campaign_id=p_campaign;
 return v_count;
end;$function$;

CREATE OR REPLACE FUNCTION public.review_business_approval(p_request_id uuid, p_approve boolean, p_note text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v public.business_approval_requests%rowtype;
begin
 select * into v from public.business_approval_requests where id=p_request_id for update;
 if not found or v.status<>'pending' then raise exception 'Approval unavailable';end if;
 if not public.is_business_owner(v.business_id) then raise exception 'Only owners can review';end if;
 if not public.business_has_feature(v.business_id,'team') or not public.business_can_perform_action(v.business_id,'team','approve') then raise exception 'Approval permission denied' using errcode='42501';end if;
 if v.requested_by=auth.uid() then raise exception 'Self approval forbidden';end if;
 update public.business_approval_requests set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_by=auth.uid(),reviewed_at=now(),review_note=left(coalesce(p_note,''),500) where id=p_request_id;
 -- Decision is a review record only; no direct financial posting occurs here.
end;$function$;
COMMIT;