-- Phase 06: Catalog and controlled inventory. Apply after migration 006.
-- Services cannot track physical stock; inventory quantities are non-negative.
alter table public.products add column if not exists item_type text not null default 'product';
alter table public.products add column if not exists track_inventory boolean not null default true;
alter table public.products add constraint products_item_type_valid check (item_type in ('product','service','package'));
alter table public.products add constraint products_stock_nonnegative check(stock_quantity >= 0);
alter table public.products add constraint services_do_not_track_stock check(item_type <> 'service' or track_inventory = false);
create index if not exists idx_products_business_type on public.products(business_id,item_type,active);
create index if not exists idx_inventory_movements_business on public.inventory_movements(business_id,created_at desc);
-- Deny direct writes: all writes must use business-scoped RPCs.
drop policy if exists products_member_access on public.products;
create policy products_read on public.products for select to authenticated using(public.is_business_member(business_id));
drop policy if exists inventory_member_access on public.inventory_movements;
create policy inventory_read on public.inventory_movements for select to authenticated using(public.is_business_member(business_id));
create or replace function public.catalog_create_item(p_business uuid,p_name text,p_type text,p_sku text,p_description text,p_price numeric,p_cost numeric,p_track boolean,p_initial_stock numeric,p_minimum numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_role text;
begin
 select role::text into v_role from public.business_members where business_id=p_business and user_id=auth.uid() limit 1;
 if v_role is null or v_role not in ('owner','admin') then raise exception 'Not authorised'; end if;
 if trim(coalesce(p_name,''))='' or length(p_name)>160 or p_type not in ('product','service','package') or p_price is null or p_price<0 or p_cost is null or p_cost<0 or p_initial_stock is null or p_initial_stock<0 or p_minimum is null or p_minimum<0 then raise exception 'Invalid item'; end if;
 if p_type='service' and (p_track or p_initial_stock<>0) then raise exception 'Services cannot track stock'; end if;
 if not p_track and p_initial_stock<>0 then raise exception 'Stock cannot be supplied when tracking is off'; end if;
 insert into public.products(business_id,name,sku,description,selling_price,cost_price,stock_quantity,minimum_stock,item_type,track_inventory)
 values(p_business,trim(p_name),nullif(trim(coalesce(p_sku,'')),''),nullif(trim(coalesce(p_description,'')),''),p_price,p_cost,p_initial_stock,p_minimum,p_type,p_track) returning id into v_id;
 if p_track and p_initial_stock>0 then
  insert into public.inventory_movements(business_id,product_id,movement_type,quantity,notes) values(p_business,v_id,'adjustment',p_initial_stock,'Opening stock');
 end if;
 return v_id;
end $$;
create or replace function public.inventory_adjust_stock(p_business uuid,p_item uuid,p_delta numeric,p_reason text)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_role text; v_stock numeric; v_track boolean;
begin
 select role::text into v_role from public.business_members where business_id=p_business and user_id=auth.uid() limit 1;
 if v_role is null or v_role not in ('owner','admin') then raise exception 'Not authorised'; end if;
 if p_delta is null or p_delta=0 or abs(p_delta)>100000000 or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Invalid adjustment'; end if;
 select stock_quantity,track_inventory into v_stock,v_track from public.products where id=p_item and business_id=p_business and active=true for update;
 if not found or not v_track then raise exception 'Tracked product not found'; end if;
 if v_stock+p_delta<0 then raise exception 'Stock cannot be negative'; end if;
 update public.products set stock_quantity=v_stock+p_delta,updated_at=now() where id=p_item and business_id=p_business;
 insert into public.inventory_movements(business_id,product_id,movement_type,quantity,notes) values(p_business,p_item,'adjustment',p_delta,trim(p_reason));
 return v_stock+p_delta;
end $$;
revoke all on function public.catalog_create_item(uuid,text,text,text,text,numeric,numeric,boolean,numeric,numeric) from public,anon;
revoke all on function public.inventory_adjust_stock(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.catalog_create_item(uuid,text,text,text,text,numeric,numeric,boolean,numeric,numeric) to authenticated;
grant execute on function public.inventory_adjust_stock(uuid,uuid,numeric,text) to authenticated;
