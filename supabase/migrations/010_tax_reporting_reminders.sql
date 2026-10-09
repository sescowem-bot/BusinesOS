-- Phase 09: tax compliance reminders are manually verified, never auto-created from guessed thresholds.
create table if not exists public.tax_obligation_reminders (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 tax_kind text not null check (tax_kind in ('vat','wht','paye','cit','pit','other')),
 period_end date not null,due_date date not null,
 status text not null default 'review_required' check(status in ('review_required','verified','filed','not_applicable')),
 legal_source_id uuid references public.tax_law_sources(id),
 notes text not null default '',
 verified_by uuid references auth.users(id),verified_at timestamptz,
 created_at timestamptz not null default now(),
 check(due_date>=period_end),
 check((status in ('verified','filed'))=false or (verified_by is not null and verified_at is not null)),
 unique(business_id,tax_kind,period_end)
);
create index if not exists tax_reminders_due_idx on public.tax_obligation_reminders(business_id,due_date);
alter table public.tax_obligation_reminders enable row level security;
create policy tax_reminders_finance_read on public.tax_obligation_reminders for select to authenticated using(public.gl_can_manage(business_id));
revoke all on public.tax_obligation_reminders from anon;
grant select on public.tax_obligation_reminders to authenticated;
revoke insert,update,delete on public.tax_obligation_reminders from authenticated;
-- Only a trusted server-side back-office workflow with reviewed supporting evidence may
-- create or update reminders. A normal business member cannot forge verification.
