-- Phase 14: Non-destructive team, branches and approval foundations.
create table if not exists public.business_branches (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null check (length(trim(name)) between 2 and 120), code text not null check(length(trim(code)) between 2 and 25),
 address text not null default '', active boolean not null default true, created_at timestamptz not null default now(),
 unique(business_id,code),unique(id,business_id)
);
create table if not exists public.business_branch_members (
 business_id uuid not null, branch_id uuid not null, user_id uuid not null,
 created_at timestamptz not null default now(),primary key(branch_id,user_id),
 foreign key(branch_id,business_id) references public.business_branches(id,business_id) on delete cascade,
 foreign key(business_id,user_id) references public.business_members(business_id,user_id) on delete cascade
);
create table if not exists public.business_team_invitations (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 email citext not null, role public.member_role not null check(role<>'owner'),
 status text not null default 'pending' check(status in ('pending','accepted','revoked','expired')),
 expires_at timestamptz not null default (now()+interval '7 days'),
 invited_by uuid not null references auth.users(id), accepted_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id,business_id)
);
create unique index if not exists one_pending_business_invitation on public.business_team_invitations(business_id,email) where status='pending';
create table if not exists public.business_approval_requests (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 title text not null check(length(trim(title)) between 3 and 160),details text not null default '',
 request_type text not null check(request_type in ('expense','purchase','adjustment','other')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 requested_by uuid not null references auth.users(id),reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,review_note text,created_at timestamptz not null default now()
);
create index if not exists idx_branch_business on public.business_branches(business_id);
create index if not exists idx_invitation_business on public.business_team_invitations(business_id,status);
create index if not exists idx_approval_business on public.business_approval_requests(business_id,status,created_at desc);
alter table public.business_branches enable row level security;
alter table public.business_branch_members enable row level security;
alter table public.business_team_invitations enable row level security;
alter table public.business_approval_requests enable row level security;
revoke all on public.business_branches,public.business_branch_members,public.business_team_invitations,public.business_approval_requests from anon,authenticated;
create policy branch_read on public.business_branches for select to authenticated using(public.is_business_member(business_id));
create policy branch_member_read on public.business_branch_members for select to authenticated using(public.is_business_member(business_id));
create policy branch_owner_write on public.business_branches for all to authenticated using(public.is_business_owner(business_id)) with check(public.is_business_owner(business_id));
create policy branch_assign_owner on public.business_branch_members for all to authenticated using(public.is_business_owner(business_id)) with check(public.is_business_owner(business_id));
create policy invites_owner_read on public.business_team_invitations for select to authenticated using(public.is_business_owner(business_id));
create policy approval_business_read on public.business_approval_requests for select to authenticated using(public.is_business_member(business_id));
create policy approval_create on public.business_approval_requests for insert to authenticated with check(public.is_business_member(business_id) and requested_by=auth.uid() and status='pending');
grant select,insert,update on public.business_branches to authenticated;
grant select,insert,delete on public.business_branch_members to authenticated;
grant select on public.business_team_invitations to authenticated;
grant select,insert on public.business_approval_requests to authenticated;
-- Invitations and approval decisions are changed only through privileged, authenticated RPCs.
create or replace function public.create_team_invitation(p_business_id uuid,p_email text,p_role public.member_role)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_email citext;
begin
 if not public.is_business_owner(p_business_id) then raise exception 'Only owners can invite';end if;
 v_email:=lower(trim(p_email))::citext;
 if length(v_email)>254 or v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email';end if;
 if p_role='owner' then raise exception 'Owner invitation prohibited';end if;
 insert into public.business_team_invitations(business_id,email,role,invited_by)
 values(p_business_id,v_email,p_role,auth.uid()) returning id into v_id;
 return v_id;
end;$$;
create or replace function public.accept_team_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.business_team_invitations%rowtype; v_email text;
begin
 if auth.uid() is null then raise exception 'Not authenticated';end if;
 v_email:=lower(coalesce(auth.jwt()->>'email',''));
 if coalesce(auth.jwt()->>'email_verified','false') not in ('true','True') then
   -- Supabase JWTs commonly use user_metadata and do not always carry email_verified.
   -- Verify against auth.users below instead.
   null;
 end if;
 select * into v from public.business_team_invitations where id=p_invitation_id for update;
 if not found or v.status<>'pending' or v.expires_at<=now() then raise exception 'Invitation not available';end if;
 if lower(v.email::text)<>v_email then raise exception 'Invitation recipient mismatch';end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=v_email) then
  raise exception 'Verified email required';end if;
 insert into public.business_members(business_id,user_id,role) values(v.business_id,auth.uid(),v.role)
 on conflict(business_id,user_id) do nothing;
 update public.business_team_invitations set status='accepted',accepted_by=auth.uid() where id=v.id;
 return v.business_id;
end;$$;
create or replace function public.review_business_approval(p_request_id uuid,p_approve boolean,p_note text default '')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.business_approval_requests%rowtype;
begin
 select * into v from public.business_approval_requests where id=p_request_id for update;
 if not found or v.status<>'pending' then raise exception 'Approval unavailable';end if;
 if not public.is_business_owner(v.business_id) then raise exception 'Only owners can review';end if;
 if v.requested_by=auth.uid() then raise exception 'Self approval forbidden';end if;
 update public.business_approval_requests set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_by=auth.uid(),reviewed_at=now(),review_note=left(coalesce(p_note,''),500) where id=p_request_id;
 -- Decision is a review record only; no direct financial posting occurs here.
end;$$;
revoke all on function public.create_team_invitation(uuid,text,public.member_role),public.accept_team_invitation(uuid),public.review_business_approval(uuid,boolean,text) from public,anon;
grant execute on function public.create_team_invitation(uuid,text,public.member_role),public.accept_team_invitation(uuid),public.review_business_approval(uuid,boolean,text) to authenticated;
