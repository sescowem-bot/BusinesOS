-- 017: Roles and administrator-controlled upgrades. Apply after 016.
create table if not exists public.business_plan_assignments (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 plan_id text not null references public.public_site_plans(id),
 approved_request_id uuid,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.business_upgrade_requests (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 plan_id text not null references public.public_site_plans(id),
 status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
 justification text not null default '' check (length(justification)<=1200),
 requested_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),
 review_note text not null default '',
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint review_fields_consistent check ((status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null) or (status in ('pending','cancelled') and reviewed_by is null and reviewed_at is null))
);
create unique index if not exists one_pending_upgrade_per_business on public.business_upgrade_requests(business_id) where status='pending';
create index if not exists upgrade_pending_lookup on public.business_upgrade_requests(status,requested_at desc);
alter table public.business_plan_assignments enable row level security;
alter table public.business_upgrade_requests enable row level security;
revoke all on public.business_plan_assignments,public.business_upgrade_requests from anon,authenticated;
grant select on public.business_plan_assignments,public.business_upgrade_requests to authenticated;
create policy plan_assignment_read on public.business_plan_assignments for select to authenticated using (public.is_business_member(business_id) or exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.active));
create policy upgrade_request_read on public.business_upgrade_requests for select to authenticated using (public.is_business_member(business_id) or exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.active));
create or replace function public.request_business_upgrade(p_business_id uuid,p_plan_id text,p_justification text default '') returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_business_owner(p_business_id) then raise exception 'Only the business owner can request a plan upgrade'; end if;
 if not exists(select 1 from public.public_site_plans where id=p_plan_id and published) then raise exception 'Requested plan is not available'; end if;
 if exists(select 1 from public.business_upgrade_requests where business_id=p_business_id and status='pending') then raise exception 'A request is already awaiting review'; end if;
 if exists(select 1 from public.business_plan_assignments where business_id=p_business_id and plan_id=p_plan_id) then raise exception 'Business is already on this plan'; end if;
 insert into public.business_upgrade_requests(business_id,plan_id,justification,requested_by)
 values(p_business_id,p_plan_id,left(trim(coalesce(p_justification,'')),1200),auth.uid()) returning id into v_id;
 return v_id;
end;$$;
create or replace function public.review_business_upgrade(p_request_id uuid,p_approve boolean,p_note text default '') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.business_upgrade_requests%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.platform_admins where user_id=auth.uid() and active) then raise exception 'Platform administrator access required'; end if;
 select * into v_request from public.business_upgrade_requests where id=p_request_id for update;
 if not found then raise exception 'Upgrade request not found'; end if;
 if v_request.status<>'pending' then raise exception 'Request already reviewed'; end if;
 if p_approve and not exists(select 1 from public.public_site_plans where id=v_request.plan_id and published) then raise exception 'Plan is no longer available'; end if;
 update public.business_upgrade_requests set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_by=auth.uid(),reviewed_at=now(),review_note=left(trim(coalesce(p_note,'')),1200) where id=p_request_id;
 if p_approve then
  insert into public.business_plan_assignments(business_id,plan_id,approved_request_id,approved_by,approved_at)
  values(v_request.business_id,v_request.plan_id,v_request.id,auth.uid(),now())
  on conflict (business_id) do update set plan_id=excluded.plan_id,approved_request_id=excluded.approved_request_id,
  approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=now();
 end if;
end;$$;
revoke all on function public.request_business_upgrade(uuid,text,text),public.review_business_upgrade(uuid,boolean,text) from public,anon;
grant execute on function public.request_business_upgrade(uuid,text,text),public.review_business_upgrade(uuid,boolean,text) to authenticated;
-- Prevent client-managed writes, including attempts to bypass approval.
