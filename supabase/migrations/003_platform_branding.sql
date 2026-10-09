-- Phase 02: platform identity and role-gated administration.
-- Apply only after 001_core.sql and 002_phase01_harden_calculations.sql.
create table if not exists public.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.platform_branding (
 id boolean primary key default true check (id = true),
 name text not null default 'BusinessOS' check (char_length(name) between 2 and 90),
 short_name text not null default 'BusinessOS' check (char_length(short_name) between 2 and 28),
 tagline text not null default 'Run your business. Stay in control.',
 description text not null default 'A modern operating platform for small and growing businesses.',
 support_email text not null default '', support_phone text not null default '',
 logo_url text not null default '',favicon_url text not null default '',
 primary_color text not null default '#123B63' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
 accent_color text not null default '#16845B' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
insert into public.platform_branding(id) values (true) on conflict(id) do nothing;
create table if not exists public.platform_branding_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 changed_at timestamptz not null default now(),
 previous_value jsonb not null,new_value jsonb not null
);
alter table public.platform_admins enable row level security;
alter table public.platform_branding enable row level security;
alter table public.platform_branding_audit enable row level security;
revoke all on public.platform_admins from anon,authenticated;
revoke all on public.platform_branding_audit from anon,authenticated;
grant select on public.platform_admins to authenticated;
grant select on public.platform_branding to anon,authenticated;
grant update(name,short_name,tagline,description,support_email,support_phone,logo_url,favicon_url,primary_color,accent_color) on public.platform_branding to authenticated;
create policy platform_admin_self on public.platform_admins for select to authenticated using (user_id=(select auth.uid()));
create policy platform_brand_public_read on public.platform_branding for select to anon,authenticated using (true);
create policy platform_brand_admin_update on public.platform_branding for update to authenticated
 using (exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.active))
 with check (exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.active));
create or replace function public.audit_platform_branding() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 new.updated_by := auth.uid();new.updated_at:=now();
 insert into public.platform_branding_audit(actor_id,previous_value,new_value) values (auth.uid(),to_jsonb(old),to_jsonb(new));
 return new;
end;$$;
revoke all on function public.audit_platform_branding() from public,anon,authenticated;
create trigger trg_audit_platform_branding before update on public.platform_branding for each row execute function public.audit_platform_branding();
-- One-time bootstrap by the project/database owner (NEVER from the browser):
-- insert into public.platform_admins (user_id) values ('REPLACE-WITH-EXISTING-AUTH-USER-UUID');
