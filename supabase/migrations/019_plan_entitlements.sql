-- 019: Server-side plan entitlements. Apply AFTER migration 018.
-- Does not charge customers or auto-upgrade a plan.
create table if not exists public.platform_plan_features (
 plan_id text not null references public.public_site_plans(id) on delete cascade,
 feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_]{1,63}$'),
 enabled boolean not null default false,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(plan_id, feature_key)
);
alter table public.platform_plan_features enable row level security;
revoke all on public.platform_plan_features from anon, authenticated;
grant select on public.platform_plan_features to authenticated;
create policy platform_plan_features_read on public.platform_plan_features for select to authenticated using (
 exists(select 1 from public.platform_admins where user_id=auth.uid() and active)
 or exists(select 1 from public.business_plan_assignments a where a.plan_id=platform_plan_features.plan_id and public.is_business_member(a.business_id))
);
-- Per-feature settings are edited through this administrative function only.
create or replace function public.admin_set_plan_feature(p_plan_id text,p_feature_key text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not exists(select 1 from public.platform_admins where user_id=auth.uid() and active) then
   raise exception 'Platform administrator access required';
 end if;
 if p_feature_key not in ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team') then
   raise exception 'Unknown feature';
 end if;
 insert into public.platform_plan_features(plan_id,feature_key,enabled,updated_by)
 values(p_plan_id,p_feature_key,p_enabled,auth.uid())
 on conflict(plan_id,feature_key) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
end;$$;
-- Default unassigned access: core operational workspace only, no premium modules.
-- Missing feature rows always mean disabled; admin explicitly enables plan features.
create or replace function public.business_has_feature(p_business_id uuid,p_feature_key text)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_plan text;
begin
 if auth.uid() is null or not public.is_business_member(p_business_id) then return false; end if;
 if p_feature_key in ('dashboard','customers','orders','payments','expenses','products','settings','upgrade') then return true; end if;
 select plan_id into v_plan from public.business_plan_assignments where business_id=p_business_id;
 if v_plan is null then return false; end if;
 return exists(select 1 from public.platform_plan_features where plan_id=v_plan and feature_key=p_feature_key and enabled=true);
end;$$;
revoke all on function public.admin_set_plan_feature(text,text,boolean), public.business_has_feature(uuid,text) from public,anon;
grant execute on function public.admin_set_plan_feature(text,text,boolean), public.business_has_feature(uuid,text) to authenticated;
-- Plans must not change without admin approval; migration 017 retains the approval transaction.
