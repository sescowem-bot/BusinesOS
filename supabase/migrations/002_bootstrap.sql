-- Bootstrap function: lets a newly signed-up user create their first business.
-- Needed because business_owner_write / members_owner_write policies require
-- an existing business_members row, which can't exist before this runs.
-- security definer + owned by postgres (superuser) => bypasses RLS safely.
create or replace function public.create_business_with_owner(
  p_name text,
  p_category text default 'Other',
  p_phone text default null,
  p_whatsapp text default null,
  p_city text default null,
  p_currency text default 'NGN'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_slug := lower(regexp_replace(coalesce(p_name,'business') || '-' || substr(gen_random_uuid()::text,1,8), '[^a-zA-Z0-9]+','-','g'));

  insert into public.businesses(name,slug,category,phone,whatsapp,city,currency)
  values (coalesce(p_name,'My Business'), v_slug, coalesce(p_category,'Other'), p_phone, p_whatsapp, p_city, coalesce(p_currency,'NGN'))
  returning id into v_id;

  insert into public.business_members(business_id,user_id,role)
  values (v_id, auth.uid(), 'owner');

  return v_id;
end;
$$;

grant execute on function public.create_business_with_owner(text,text,text,text,text,text) to authenticated;

-- Helper the client can call cheaply to get "my" business id without
-- re-deriving membership joins on every page.
create or replace function public.get_my_business_id()
returns uuid language sql stable security definer set search_path = public as $$
  select business_id from public.business_members where user_id = auth.uid() order by created_at asc limit 1;
$$;

grant execute on function public.get_my_business_id() to authenticated;

-- Upsert-by-name helpers so forms can type a free-text category without
-- a separate "manage categories" screen.
create or replace function public.get_or_create_product_category(p_business_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_name is null or trim(p_name) = '' then return null; end if;
  if not public.is_business_member(p_business_id) then raise exception 'Not a member of this business'; end if;
  select id into v_id from public.product_categories where business_id = p_business_id and name = trim(p_name);
  if v_id is null then
    insert into public.product_categories(business_id,name) values (p_business_id, trim(p_name)) returning id into v_id;
  end if;
  return v_id;
end;
$$;

grant execute on function public.get_or_create_product_category(uuid,text) to authenticated;

create or replace function public.get_or_create_expense_category(p_business_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_name is null or trim(p_name) = '' then return null; end if;
  if not public.is_business_member(p_business_id) then raise exception 'Not a member of this business'; end if;
  select id into v_id from public.expense_categories where business_id = p_business_id and name = trim(p_name);
  if v_id is null then
    insert into public.expense_categories(business_id,name) values (p_business_id, trim(p_name)) returning id into v_id;
  end if;
  return v_id;
end;
$$;

grant execute on function public.get_or_create_expense_category(uuid,text) to authenticated;
