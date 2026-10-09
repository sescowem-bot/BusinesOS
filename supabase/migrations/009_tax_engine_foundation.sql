-- Phase 08. Controlled classifications only; no autonomous legal determination or filing.
create table if not exists public.tax_law_sources (
 id uuid primary key default gen_random_uuid(), title text not null, source_url text not null,
 publication_date date, jurisdiction text not null default 'NG',
 created_at timestamptz not null default now(),
 constraint tax_source_https check(source_url ~ '^https://')
);
create table if not exists public.tax_rule_versions (
 id uuid primary key default gen_random_uuid(),source_id uuid not null references public.tax_law_sources(id),
 rule_code text not null, tax_kind text not null check(tax_kind in ('vat','wht','paye','cit','pit','other')),
 treatment text not null check(treatment in ('standard','zero_rated','exempt','outside_scope')),
 rate_basis_points integer not null check(rate_basis_points between 0 and 10000),
 legal_reference text not null, effective_from date not null,effective_to date,
 status text not null default 'draft' check(status in ('draft','approved','retired')),
 approved_by uuid references auth.users(id),approved_at timestamptz,
 created_at timestamptz not null default now(),
 check(effective_to is null or effective_to>=effective_from),
 check((status='approved' and approved_by is not null and approved_at is not null) or status<>'approved'),
 unique(rule_code,effective_from)
);
create table if not exists public.business_tax_assignments (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 supply_id uuid not null references public.business_supply_categories(id) on delete cascade,
 rule_version_id uuid not null references public.tax_rule_versions(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewer_id uuid references auth.users(id),reviewed_at timestamptz,notes text not null default '',
 created_at timestamptz not null default now(),unique(business_id,supply_id,rule_version_id),
 check((status='approved' and reviewer_id is not null and reviewed_at is not null) or status<>'approved')
);
create table if not exists public.tax_calculation_snapshots (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 calculated_by uuid references auth.users(id),transaction_reference text,
 tax_date date not null,inputs jsonb not null,outputs jsonb not null,
 status text not null check(status in ('review_required','provisional','approved')),
 created_at timestamptz not null default now()
);
create index if not exists tax_assignments_tenant_idx on public.business_tax_assignments(business_id);
create index if not exists tax_snapshots_tenant_idx on public.tax_calculation_snapshots(business_id,tax_date);
create index if not exists tax_rule_lookup_idx on public.tax_rule_versions(rule_code,effective_from,status);
alter table public.tax_law_sources enable row level security;
alter table public.tax_rule_versions enable row level security;
alter table public.business_tax_assignments enable row level security;
alter table public.tax_calculation_snapshots enable row level security;
create policy tax_sources_read on public.tax_law_sources for select to authenticated using(true);
create policy tax_rules_read on public.tax_rule_versions for select to authenticated using(status='approved' or exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.active));
create policy tax_assignments_read on public.business_tax_assignments for select to authenticated using(public.is_business_member(business_id));
create policy tax_snapshots_read on public.tax_calculation_snapshots for select to authenticated using(public.is_business_member(business_id));
-- Only the trusted administrative backend may maintain legal sources, rule approvals,
-- assignments and snapshots. Do not grant tenant-side write policies.
revoke all on public.tax_law_sources,public.tax_rule_versions,public.business_tax_assignments,public.tax_calculation_snapshots from anon;
grant select on public.tax_law_sources,public.tax_rule_versions,public.business_tax_assignments,public.tax_calculation_snapshots to authenticated;
