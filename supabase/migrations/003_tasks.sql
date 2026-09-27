-- Tasks / reminders — not in the original schema, needed for the Tasks page.
create type public.task_status as enum ('open','done');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  due_date date,
  status public.task_status not null default 'open',
  related_customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_business_status on public.tasks(business_id,status,due_date);

alter table public.tasks enable row level security;
create policy tasks_member_access on public.tasks for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
