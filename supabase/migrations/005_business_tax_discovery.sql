-- Phase 04: tax discovery only. No rates and no automated tax assessment.
create table if not exists public.business_tax_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  legal_structure text not null default 'unknown' check (legal_structure in ('unknown','individual','business_name','company','partnership','other')),
  turnover_band text not null default 'unknown' check (turnover_band in ('unknown','under_50m','50m_100m','over_100m')),
  employs_staff boolean,
  vat_registration_status text not null default 'unknown' check(vat_registration_status in ('unknown','registered','not_registered','pending')),
  activities text[] not null default array[]::text[],
  goods_services text not null default '',
  notes text not null default '',
  classification_status text not null default 'needs_review' check(classification_status in ('needs_review','reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_limited check (coalesce(array_length(activities,1),0)<=15),
  constraint profile_text_limited check(length(goods_services)<=2000 and length(notes)<=1000)
);
create table if not exists public.business_supply_categories (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 2 and 120),
 supply_kind text not null check (supply_kind in ('goods','services','mixed')),
 proposed_vat_treatment text not null default 'needs_review' check (proposed_vat_treatment in ('needs_review','standard','zero_rated','exempt','outside_scope')),
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 unique(business_id,name)
);
create index if not exists idx_supply_business on public.business_supply_categories(business_id);
alter table public.business_tax_profiles enable row level security;
alter table public.business_supply_categories enable row level security;
-- Read is available to workspace members; write limited to owners and finance managers.
create policy tax_profile_member_select on public.business_tax_profiles for select to authenticated using (public.is_business_member(business_id));
create policy tax_profile_owner_insert on public.business_tax_profiles for insert to authenticated with check (public.is_business_owner(business_id));
create policy tax_profile_owner_update on public.business_tax_profiles for update to authenticated using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
create policy supply_member_select on public.business_supply_categories for select to authenticated using (public.is_business_member(business_id));
create policy supply_owner_insert on public.business_supply_categories for insert to authenticated with check (public.is_business_owner(business_id) and proposed_vat_treatment='needs_review' and verified_by is null and verified_at is null);
create policy supply_owner_update on public.business_supply_categories for update to authenticated using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id) and proposed_vat_treatment='needs_review' and verified_by is null and verified_at is null);
create policy supply_owner_delete on public.business_supply_categories for delete to authenticated using (public.is_business_owner(business_id));
-- No automatic tax assignment or tax collection. Classification requires future legal review.
