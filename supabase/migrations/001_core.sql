-- BusinessOS production schema. Apply in Supabase SQL editor.
create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.member_role as enum ('owner','manager','sales','inventory','finance','staff');
create type public.order_status as enum ('new','confirmed','processing','ready','delivered','completed','cancelled');
create type public.payment_method as enum ('cash','transfer','pos','card','online','other');
create type public.payment_status as enum ('pending','completed','failed','refunded','voided');
create type public.quote_status as enum ('draft','sent','accepted','rejected','expired','converted');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null default 'Other',
  description text,
  logo_url text,
  cover_url text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  state text,
  country text not null default 'Nigeria',
  currency text not null default 'NGN',
  tax_enabled boolean not null default false,
  tax_name text,
  tax_rate numeric(8,4) not null default 0 check (tax_rate >= 0),
  published boolean not null default false,
  verified boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (business_id,user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_customers (
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status text not null default 'active',
  first_order_at timestamptz,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (business_id,customer_id)
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  unique(business_id,name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  sku text,
  description text,
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  stock_quantity numeric(14,3) not null default 0,
  minimum_stock numeric(14,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,sku)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_number text not null,
  status public.order_status not null default 'new',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0),
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  total numeric(14,2) generated always as (greatest(0, subtotal - discount + tax + delivery_fee)) stored,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,order_number)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  line_total numeric(14,2) generated always as (quantity * unit_price) stored
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'transfer',
  status public.payment_status not null default 'completed',
  reference text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  deposit_amount numeric(14,2) not null default 0 check (deposit_amount >= 0),
  frequency text not null default 'monthly',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.installment_schedule (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.installment_plans(id) on delete cascade,
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'due'
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  unique(business_id,name)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  attachment_url text,
  created_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('purchase','sale','return','damage','adjustment','transfer')),
  quantity numeric(14,3) not null,
  reference_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  quote_number text not null,
  status public.quote_status not null default 'draft',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (greatest(0,subtotal-discount+tax)) stored,
  expires_at date,
  created_at timestamptz not null default now(),
  unique(business_id,quote_number)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  name text not null,
  quantity numeric(14,3) not null check(quantity>0),
  unit_price numeric(14,2) not null check(unit_price>=0)
);

create table public.business_followers (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(business_id,user_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating int not null check(rating between 1 and 5),
  comment text,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  unique(user_id,order_id)
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  monthly_price numeric(14,2) not null default 0,
  active boolean not null default true
);

create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ends_at timestamptz
);

create table public.partner_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.partner_consents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  partner_id uuid not null references public.partner_organizations(id) on delete cascade,
  purpose text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_members_user on public.business_members(user_id);
create index idx_customers_user on public.customers(user_id);
create index idx_orders_business_created on public.orders(business_id,created_at desc);
create index idx_orders_customer on public.orders(customer_id);
create index idx_payments_business_paid on public.payments(business_id,paid_at desc);
create index idx_expenses_business_paid on public.expenses(business_id,paid_at desc);
create index idx_products_business on public.products(business_id);
create index idx_inventory_product on public.inventory_movements(product_id,created_at desc);

create or replace function public.is_business_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.business_members bm where bm.business_id=p_business_id and bm.user_id=auth.uid());
$$;

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.business_members bm where bm.business_id=p_business_id and bm.user_id=auth.uid() and bm.role='owner');
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.customers enable row level security;
alter table public.business_customers enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.installment_plans enable row level security;
alter table public.installment_schedule enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_categories enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.business_followers enable row level security;
alter table public.reviews enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.partner_consents enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self on public.profiles for all using (id=auth.uid()) with check(id=auth.uid());
create policy business_member_read on public.businesses for select using (public.is_business_member(id) or (published=true));
create policy business_owner_write on public.businesses for all using (public.is_business_owner(id)) with check (public.is_business_owner(id));
create policy members_member_read on public.business_members for select using (public.is_business_member(business_id));
create policy members_owner_write on public.business_members for all using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

create policy customers_member_access on public.customers for all using (exists(select 1 from public.business_customers bc where bc.customer_id=id and public.is_business_member(bc.business_id)) or user_id=auth.uid()) with check (user_id=auth.uid() or exists(select 1 from public.business_customers bc where bc.customer_id=id and public.is_business_member(bc.business_id)));
create policy business_customers_member_access on public.business_customers for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy products_member_access on public.products for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy categories_member_access on public.product_categories for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy orders_member_access on public.orders for all using(public.is_business_member(business_id) or exists(select 1 from public.customers c where c.id=customer_id and c.user_id=auth.uid())) with check(public.is_business_member(business_id));
create policy order_items_member_access on public.order_items for all using(exists(select 1 from public.orders o where o.id=order_id and public.is_business_member(o.business_id))) with check(exists(select 1 from public.orders o where o.id=order_id and public.is_business_member(o.business_id)));
create policy payments_member_access on public.payments for all using(public.is_business_member(business_id) or exists(select 1 from public.customers c where c.id=customer_id and c.user_id=auth.uid())) with check(public.is_business_member(business_id));
create policy installment_member_access on public.installment_plans for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy installment_schedule_access on public.installment_schedule for all using(exists(select 1 from public.installment_plans p where p.id=plan_id and public.is_business_member(p.business_id))) with check(exists(select 1 from public.installment_plans p where p.id=plan_id and public.is_business_member(p.business_id)));
create policy expense_member_access on public.expenses for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy expense_categories_access on public.expense_categories for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy inventory_member_access on public.inventory_movements for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy quote_member_access on public.quotes for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy quote_items_member_access on public.quote_items for all using(exists(select 1 from public.quotes q where q.id=quote_id and public.is_business_member(q.business_id))) with check(exists(select 1 from public.quotes q where q.id=quote_id and public.is_business_member(q.business_id)));
create policy followers_read_self on public.business_followers for select using(user_id=auth.uid() or public.is_business_member(business_id));
create policy followers_write_self on public.business_followers for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy reviews_public_read on public.reviews for select using(status='published' or user_id=auth.uid() or public.is_business_member(business_id));
create policy reviews_self_write on public.reviews for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy subscriptions_member_read on public.business_subscriptions for select using(public.is_business_member(business_id));
create policy partner_consent_member_access on public.partner_consents for all using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy audit_member_read on public.audit_logs for select using(public.is_business_member(business_id));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,phone) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.phone) on conflict(id) do nothing; return new; end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.calculate_customer_balance(p_customer uuid,p_business uuid)
returns numeric language sql stable security definer set search_path=public as $$
select coalesce((select sum(o.total) from public.orders o where o.business_id=p_business and o.customer_id=p_customer and o.status<>'cancelled'),0)-coalesce((select sum(p.amount) from public.payments p where p.business_id=p_business and p.customer_id=p_customer and p.status='completed'),0);
$$;

create or replace function public.calculate_order_paid(p_order uuid)
returns numeric language sql stable security definer set search_path=public as $$select coalesce(sum(amount),0) from public.payments where order_id=p_order and status='completed';$$;

create or replace function public.calculate_order_balance(p_order uuid)
returns numeric language sql stable security definer set search_path=public as $$select greatest(0,(select total from public.orders where id=p_order)-public.calculate_order_paid(p_order));$$;

insert into public.subscription_plans(name,description,monthly_price) values('Free','Core business management',0),('Pro','Advanced reporting, reminders and team features',3000),('Growth','Advanced visibility and business growth tools',7000) on conflict(name) do nothing;
