-- PHASE 01: Audit hardening of exposed SECURITY DEFINER calculation helpers.
-- Review against deployed schema, backup first, execute in a controlled migration.
-- Existing helper behaviour intentionally remains for authorised business members.
create or replace function public.calculate_customer_balance(p_customer uuid,p_business uuid)
returns numeric language plpgsql stable security invoker set search_path = public as $$
begin
  if auth.uid() is null or not public.is_business_member(p_business) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return coalesce((select sum(o.total) from public.orders o where o.business_id=p_business and o.customer_id=p_customer and o.status <> 'cancelled'),0)
    - coalesce((select sum(p.amount) from public.payments p where p.business_id=p_business and p.customer_id=p_customer and p.status='completed'),0);
end;$$;

create or replace function public.calculate_order_paid(p_order uuid)
returns numeric language plpgsql stable security invoker set search_path = public as $$
declare target_business uuid;
begin
 select business_id into target_business from public.orders where id=p_order;
 if target_business is null or auth.uid() is null or not public.is_business_member(target_business) then
   raise exception 'Not authorised' using errcode='42501';
 end if;
 return coalesce((select sum(amount) from public.payments where order_id=p_order and status='completed'),0);
end;$$;

create or replace function public.calculate_order_balance(p_order uuid)
returns numeric language plpgsql stable security invoker set search_path = public as $$
declare target_business uuid; order_total numeric;
begin
 select business_id,total into target_business,order_total from public.orders where id=p_order;
 if target_business is null or auth.uid() is null or not public.is_business_member(target_business) then
   raise exception 'Not authorised' using errcode='42501';
 end if;
 return greatest(0,order_total-public.calculate_order_paid(p_order));
end;$$;
