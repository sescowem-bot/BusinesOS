-- Phase 12: document metadata and business goals. No private file uploads in this phase.
create table if not exists public.growth_documents (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 150),kind text not null check(kind in ('registration','tax','contract','licence','other')),
 reference text not null default '',notes text not null default '',expires_on date,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create table if not exists public.growth_goals (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 title text not null check(length(trim(title)) between 3 and 160),notes text not null default '',
 target_amount numeric(18,2) not null check(target_amount>0),target_date date,
 status text not null default 'planned' check(status in ('planned','in_progress','completed','cancelled')),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index if not exists idx_growth_documents_business on public.growth_documents(business_id,created_at desc);
create index if not exists idx_growth_goals_business on public.growth_goals(business_id,created_at desc);
alter table public.growth_documents enable row level security;
alter table public.growth_goals enable row level security;
revoke all on public.growth_documents,public.growth_goals from anon,authenticated;
create policy growth_documents_read on public.growth_documents for select to authenticated using (public.is_business_member(business_id));
create policy growth_goals_read on public.growth_goals for select to authenticated using (public.is_business_member(business_id));
create policy growth_documents_create on public.growth_documents for insert to authenticated with check (public.is_business_owner(business_id) and created_by=auth.uid());
create policy growth_goals_create on public.growth_goals for insert to authenticated with check (public.is_business_owner(business_id) and created_by=auth.uid() and status='planned');
grant select,insert on public.growth_documents,public.growth_goals to authenticated;
-- No update/delete privileges; corrections and progress updates require reviewed operations later.
