-- Phase 05: tenant-bound customer and financial workflows. Apply after 001-005.
-- Security definer functions perform explicit membership checks; no client-supplied tenant is trusted.
create or replace function public.crm_create_customer(p_business uuid,p_name text,p_phone text default null,p_email text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.business_members where business_id=p_business and user_id=auth.uid()) then raise exception 'Not authorised'; end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 150 or length(coalesce(p_phone,''))>40 or length(coalesce(p_email,''))>254 then raise exception 'Invalid customer details'; end if;
 insert into public.customers(name,phone,email) values(trim(p_name),nullif(trim(p_phone),''),nullif(trim(p_email),'')) returning id into v_id;
 insert into public.business_customers(business_id,customer_id) values(p_business,v_id);
 return v_id;
end;$$;

create or replace function public.crm_create_order(p_business uuid,p_customer uuid,p_description text,p_quantity numeric,p_unit_price numeric,p_discount numeric default 0,p_delivery numeric default 0,p_due_date date default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_order uuid; v_number text; v_subtotal numeric(14,2);
begin
 if auth.uid() is null or not exists(select 1 from public.business_members where business_id=p_business and user_id=auth.uid()) then raise exception 'Not authorised'; end if;
 if p_customer is not null and not exists(select 1 from public.business_customers where business_id=p_business and customer_id=p_customer) then raise exception 'Customer does not belong to this business'; end if;
 if length(trim(coalesce(p_description,''))) not between 2 and 200 or p_quantity is null or p_quantity<=0 or p_quantity>999999 or p_unit_price is null or p_unit_price<0 or p_unit_price>999999999 or coalesce(p_discount,-1)<0 or coalesce(p_delivery,-1)<0 then raise exception 'Invalid order fields'; end if;
 v_subtotal:=round(p_quantity*p_unit_price,2);
 if p_discount>v_subtotal then raise exception 'Discount exceeds subtotal'; end if;
 -- Generate a random unique business-scoped reference rather than MAX+1 (race unsafe).
 v_number:='ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 insert into public.orders(business_id,customer_id,order_number,status,subtotal,discount,delivery_fee,tax,due_date)
 values(p_business,p_customer,v_number,'new',v_subtotal,p_discount,p_delivery,0,p_due_date) returning id into v_order;
 insert into public.order_items(order_id,name_snapshot,quantity,unit_price,unit_cost) values(v_order,trim(p_description),p_quantity,p_unit_price,0);
 return v_order;
end;$$;

create or replace function public.crm_record_payment(p_business uuid,p_order uuid,p_amount numeric,p_method public.payment_method,p_reference text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_customer uuid; v_total numeric; v_paid numeric; v_payment uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.business_members where business_id=p_business and user_id=auth.uid()) then raise exception 'Not authorised'; end if;
 -- Lock order to prevent concurrent overpayments through this function.
 select customer_id,total into v_customer,v_total from public.orders where id=p_order and business_id=p_business and status<>'cancelled' for update;
 if not found then raise exception 'Order not found'; end if;
 if p_amount is null or p_amount<=0 or p_amount>999999999 or length(coalesce(p_reference,''))>150 then raise exception 'Invalid payment'; end if;
 select coalesce(sum(amount),0) into v_paid from public.payments where order_id=p_order and status='completed';
 if p_amount>v_total-v_paid then raise exception 'Payment exceeds outstanding balance'; end if;
 insert into public.payments(business_id,order_id,customer_id,amount,method,status,reference) values(p_business,p_order,v_customer,p_amount,p_method,'completed',nullif(trim(p_reference),'')) returning id into v_payment;
 return v_payment;
end;$$;
-- Disallow public/anonymous RPC execution. Functions are controlled entry points for authenticated users only.
revoke all on function public.crm_create_customer(uuid,text,text,text) from public,anon;
revoke all on function public.crm_create_order(uuid,uuid,text,numeric,numeric,numeric,numeric,date) from public,anon;
revoke all on function public.crm_record_payment(uuid,uuid,numeric,public.payment_method,text) from public,anon;
grant execute on function public.crm_create_customer(uuid,text,text,text) to authenticated;
grant execute on function public.crm_create_order(uuid,uuid,text,numeric,numeric,numeric,numeric,date) to authenticated;
grant execute on function public.crm_record_payment(uuid,uuid,numeric,public.payment_method,text) to authenticated;
-- Existing overly broad direct writes are blocked for financial records; their writes must flow through validated services.
drop policy if exists orders_member_access on public.orders;
create policy orders_member_read on public.orders for select using(public.is_business_member(business_id) or exists(select 1 from public.customers c where c.id=customer_id and c.user_id=auth.uid()));
drop policy if exists order_items_member_access on public.order_items;
create policy order_items_member_read on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and public.is_business_member(o.business_id)));
drop policy if exists payments_member_access on public.payments;
create policy payments_member_read on public.payments for select using(public.is_business_member(business_id) or exists(select 1 from public.customers c where c.id=customer_id and c.user_id=auth.uid()));
-- Prevent direct changes to shared customer identities, except the customer's own profile.
drop policy if exists customers_member_access on public.customers;
create policy customers_member_read on public.customers for select using(exists(select 1 from public.business_customers bc where bc.customer_id=id and public.is_business_member(bc.business_id)) or user_id=auth.uid());
create policy customers_self_update on public.customers for update using(user_id=auth.uid() and user_id is not null) with check(user_id=auth.uid() and user_id is not null);
