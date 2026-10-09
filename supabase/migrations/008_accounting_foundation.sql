-- Phase 07: tenant-isolated accounting foundations; apply after 007.
-- Manual journal posting only. Existing orders/payments are not automatically journalized.
create table if not exists public.gl_accounts (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 code text not null, name text not null,
 class text not null check (class in ('asset','liability','equity','income','expense')),
 normal_side text not null check (normal_side in ('debit','credit')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique (business_id, code), unique (business_id,id),
 check (length(trim(code))>0 and length(trim(name))>0)
);
create table if not exists public.gl_periods (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),
 name text not null,starts_on date not null,ends_on date not null,status text not null default 'open' check(status in ('open','closed')),
 unique(business_id,id),check(starts_on<=ends_on)
);
create table if not exists public.gl_journals (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),
 period_id uuid not null, journal_date date not null, reference text, description text not null,
 source_type text not null default 'manual',source_id uuid,
 status text not null default 'posted' check(status in ('posted','reversed')),
 reversal_of uuid references public.gl_journals(id),
 posted_by uuid not null default auth.uid(),posted_at timestamptz not null default now(),
 unique(business_id,id), foreign key(business_id,period_id) references public.gl_periods(business_id,id),
 check(length(trim(description))>0)
);
create table if not exists public.gl_lines (
 id uuid primary key default gen_random_uuid(),business_id uuid not null,
 journal_id uuid not null, account_id uuid not null, line_no integer not null,
 debit numeric(18,2) not null default 0,credit numeric(18,2) not null default 0,
 memo text,
 foreign key(business_id,journal_id) references public.gl_journals(business_id,id),
 foreign key(business_id,account_id) references public.gl_accounts(business_id,id),
 unique(journal_id,line_no),
 check(debit>=0 and credit>=0 and ((debit>0 and credit=0) or (credit>0 and debit=0)))
);
create index if not exists gl_journals_business_date on public.gl_journals(business_id,journal_date desc);
create index if not exists gl_lines_account on public.gl_lines(business_id,account_id);
create unique index if not exists gl_unique_source on public.gl_journals(business_id,source_type,source_id) where source_id is not null and reversal_of is null;
create unique index if not exists gl_one_reversal on public.gl_journals(reversal_of) where reversal_of is not null;
-- Prevent overlapping periods for a tenant, regardless of insert mechanism.
create or replace function public.gl_reject_period_overlap() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.gl_periods p where p.business_id=new.business_id and p.id<>new.id and p.starts_on<=new.ends_on and p.ends_on>=new.starts_on) then raise exception 'Accounting periods cannot overlap'; end if;
 return new;
end $$;
drop trigger if exists gl_period_overlap on public.gl_periods;
create trigger gl_period_overlap before insert or update on public.gl_periods for each row execute function public.gl_reject_period_overlap();
-- Dedicated finance roles only, never arbitrary business members.
create or replace function public.gl_can_manage(p_business uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.business_members bm where bm.business_id=p_business and bm.user_id=auth.uid() and bm.role::text in ('owner','manager','finance'));
$$;
revoke all on function public.gl_can_manage(uuid) from public;
grant execute on function public.gl_can_manage(uuid) to authenticated;
alter table public.gl_accounts enable row level security;
alter table public.gl_periods enable row level security;
alter table public.gl_journals enable row level security;
alter table public.gl_lines enable row level security;
create policy gl_account_read on public.gl_accounts for select to authenticated using(public.gl_can_manage(business_id));
create policy gl_period_read on public.gl_periods for select to authenticated using(public.gl_can_manage(business_id));
create policy gl_journal_read on public.gl_journals for select to authenticated using(public.gl_can_manage(business_id));
create policy gl_line_read on public.gl_lines for select to authenticated using(public.gl_can_manage(business_id));
-- Do not grant direct INSERT/UPDATE/DELETE on immutable posting tables.
revoke insert,update,delete on public.gl_journals,public.gl_lines from authenticated,anon;
revoke insert,update,delete on public.gl_accounts,public.gl_periods from authenticated,anon;
-- Controlled chart creation. Normal balance type is constrained by accounting class.
create or replace function public.gl_add_account(p_business uuid,p_code text,p_name text,p_class text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_normal text;
begin
 if not public.gl_can_manage(p_business) then raise exception 'Not permitted';end if;
 if p_class not in ('asset','liability','equity','income','expense') then raise exception 'Invalid account class';end if;
 v_normal:=case when p_class in ('asset','expense') then 'debit' else 'credit' end;
 insert into public.gl_accounts(business_id,code,name,class,normal_side) values(p_business,trim(p_code),trim(p_name),p_class,v_normal) returning id into v_id;
 return v_id;
end $$;
-- Controlled period creation.
create or replace function public.gl_create_period(p_business uuid,p_name text,p_start date,p_end date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.gl_can_manage(p_business) then raise exception 'Not permitted';end if;
 if p_start is null or p_end is null or p_start>p_end then raise exception 'Invalid period';end if;
 insert into public.gl_periods(business_id,name,starts_on,ends_on) values(p_business,trim(p_name),p_start,p_end) returning id into v_id;
 return v_id;
end $$;
-- Atomic, balanced journal posting. Accept entries [{account_id,debit,credit,memo}].
create or replace function public.gl_post_journal(p_business uuid,p_date date,p_description text,p_reference text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_period uuid;v_journal uuid;v_entry jsonb;v_account uuid;v_debit numeric(18,2);v_credit numeric(18,2);v_td numeric(18,2):=0;v_tc numeric(18,2):=0;v_i integer:=0;
begin
 if not public.gl_can_manage(p_business) then raise exception 'Not permitted';end if;
 if p_date is null or length(trim(coalesce(p_description,'')))=0 or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'Invalid journal';end if;
 select id into v_period from public.gl_periods where business_id=p_business and p_date between starts_on and ends_on and status='open' for update;
 if v_period is null then raise exception 'No open accounting period for journal date';end if;
 for v_entry in select value from jsonb_array_elements(p_lines) loop
  v_i:=v_i+1;
  begin
   v_account:=(v_entry->>'account_id')::uuid;
   v_debit:=round((v_entry->>'debit')::numeric,2);
   v_credit:=round((v_entry->>'credit')::numeric,2);
  exception when others then raise exception 'Invalid journal line';end;
  if v_debit is null or v_credit is null or v_debit<0 or v_credit<0 or ((v_debit>0)=(v_credit>0)) then raise exception 'Journal lines need one positive side';end if;
  if not exists(select 1 from public.gl_accounts where id=v_account and business_id=p_business and active) then raise exception 'Account not available';end if;
  v_td:=v_td+v_debit;v_tc:=v_tc+v_credit;
 end loop;
 if v_td<>v_tc or v_td<=0 then raise exception 'Journal is not balanced';end if;
 insert into public.gl_journals(business_id,period_id,journal_date,reference,description)
 values(p_business,v_period,p_date,nullif(trim(p_reference),''),trim(p_description)) returning id into v_journal;
 v_i:=0;
 for v_entry in select value from jsonb_array_elements(p_lines) loop
  v_i:=v_i+1;
  insert into public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit,memo)
  values(p_business,v_journal,(v_entry->>'account_id')::uuid,v_i,round((v_entry->>'debit')::numeric,2),round((v_entry->>'credit')::numeric,2),left(coalesce(v_entry->>'memo',''),500));
 end loop;
 return v_journal;
end $$;
revoke all on function public.gl_add_account(uuid,text,text,text),public.gl_create_period(uuid,text,date,date),public.gl_post_journal(uuid,date,text,text,jsonb) from public;
grant execute on function public.gl_add_account(uuid,text,text,text),public.gl_create_period(uuid,text,date,date),public.gl_post_journal(uuid,date,text,text,jsonb) to authenticated;
-- Balance reporting view; only permitted underlying records are accessible via RLS.
create or replace view public.gl_trial_balance with (security_invoker=true) as
 select a.business_id,a.id as account_id,a.code,a.name,a.class,a.normal_side,
 coalesce(sum(l.debit),0)::numeric(18,2) as debit_turnover,
 coalesce(sum(l.credit),0)::numeric(18,2) as credit_turnover,
 (coalesce(sum(l.debit),0)-coalesce(sum(l.credit),0))::numeric(18,2) as signed_balance
 from public.gl_accounts a left join public.gl_lines l on l.account_id=a.id and l.business_id=a.business_id
 group by a.business_id,a.id,a.code,a.name,a.class,a.normal_side;
