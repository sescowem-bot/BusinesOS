-- Phase 030E: software POS + supplier procurement. Apply ONCE after SQL 030.
-- No gateway, terminal, VAT filing, accounting journal or automatic purchase payment.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_automation_rules') IS NULL OR
 to_regclass('public.platform_plan_role_features') IS NULL OR
 to_regclass('public.business_feature_grants') IS NULL OR
 to_regclass('public.inventory_movements') IS NULL THEN
 RAISE EXCEPTION 'Required migrations through 030 missing'; END IF;
 IF to_regclass('public.business_purchase_orders') IS NOT NULL THEN
 RAISE EXCEPTION 'Phase 031 already partly installed; inspect before rerunning'; END IF;
END $$;
-- New separately sellable modules, compatible with inherited plans and business-specific grants.
ALTER TABLE public.platform_plan_role_features DROP CONSTRAINT IF EXISTS platform_plan_role_features_feature_key_check;
ALTER TABLE public.platform_plan_role_features ADD CONSTRAINT platform_plan_role_features_feature_key_check
 CHECK(feature_key IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team','pos','purchasing'));
ALTER TABLE public.business_feature_grants DROP CONSTRAINT IF EXISTS business_feature_grants_feature_key_check;
ALTER TABLE public.business_feature_grants ADD CONSTRAINT business_feature_grants_feature_key_check
 CHECK(feature_key IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team','pos','purchasing'));

CREATE TABLE public.business_suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 160), contact_name text, phone text, email text,
 notes text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES auth.users(id), UNIQUE(id,business_id)
);
CREATE INDEX business_suppliers_lookup ON public.business_suppliers(business_id,name);
CREATE TABLE public.business_purchase_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 supplier_id uuid NOT NULL,reference text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','received')),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=500), created_by uuid NOT NULL REFERENCES auth.users(id),
 received_by uuid REFERENCES auth.users(id), received_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,business_id), UNIQUE(business_id,reference),
 FOREIGN KEY(supplier_id,business_id) REFERENCES public.business_suppliers(id,business_id)
);
CREATE INDEX purchase_order_business_date ON public.business_purchase_orders(business_id,created_at DESC);
CREATE TABLE public.business_purchase_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),purchase_id uuid NOT NULL REFERENCES public.business_purchase_orders(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES public.products(id),quantity numeric(14,3) NOT NULL CHECK(quantity>0),
 unit_cost numeric(14,2) NOT NULL CHECK(unit_cost>=0), UNIQUE(purchase_id,product_id)
);
CREATE TABLE public.business_pos_sales (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL, cashier_id uuid NOT NULL REFERENCES auth.users(id),
 payment_recorded boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,request_id)
);
CREATE INDEX pos_sales_business_recent ON public.business_pos_sales(business_id,created_at DESC);

-- Read-only RLS. All writes are enforced transactionally by authenticated RPCs.
ALTER TABLE public.business_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_pos_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_suppliers,public.business_purchase_orders,public.business_purchase_items,public.business_pos_sales FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_suppliers,public.business_purchase_orders,public.business_purchase_items,public.business_pos_sales TO authenticated;
CREATE POLICY suppliers_select ON public.business_suppliers FOR SELECT TO authenticated USING(public.business_has_feature(business_id,'purchasing'));
CREATE POLICY purchase_orders_select ON public.business_purchase_orders FOR SELECT TO authenticated USING(public.business_has_feature(business_id,'purchasing'));
CREATE POLICY purchase_items_select ON public.business_purchase_items FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.business_purchase_orders p WHERE p.id=purchase_id AND public.business_has_feature(p.business_id,'purchasing')));
CREATE POLICY pos_sales_select ON public.business_pos_sales FOR SELECT TO authenticated USING(public.business_has_feature(business_id,'pos'));

CREATE FUNCTION public.business_create_supplier(p_business uuid,p_name text,p_contact text,p_phone text,p_email text,p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT EXISTS(SELECT 1 FROM public.business_members
 WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager','inventory')) THEN
 RAISE EXCEPTION 'Purchasing permission required' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 160 OR length(coalesce(p_contact,''))>160 OR
 length(coalesce(p_phone,''))>50 OR length(coalesce(p_email,''))>254 OR length(coalesce(p_notes,''))>500 THEN
 RAISE EXCEPTION 'Invalid supplier details'; END IF;
 INSERT INTO public.business_suppliers(business_id,name,contact_name,phone,email,notes,created_by)
 VALUES(p_business,btrim(p_name),nullif(btrim(coalesce(p_contact,'')),''),nullif(btrim(coalesce(p_phone,'')),''),
 nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_notes,'')),''),auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

-- A purchase order is a draft: it NEVER increases stock until received.
CREATE FUNCTION public.business_create_purchase(p_business uuid,p_supplier uuid,p_items jsonb,p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_po uuid;v_line jsonb;v_rec record;v_product uuid;v_qty numeric;v_cost numeric;v_seen uuid[]:=ARRAY[]::uuid[];
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT EXISTS(SELECT 1 FROM public.business_members
 WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager','inventory')) THEN
 RAISE EXCEPTION 'Purchasing permission required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_suppliers WHERE id=p_supplier AND business_id=p_business AND active) THEN RAISE EXCEPTION 'Supplier not found'; END IF;
 IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 30 OR length(coalesce(p_notes,''))>500 THEN
 RAISE EXCEPTION 'Invalid purchase order'; END IF;
 INSERT INTO public.business_purchase_orders(business_id,supplier_id,reference,notes,created_by)
 VALUES(p_business,p_supplier,'PO-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),coalesce(p_notes,''),auth.uid()) RETURNING id INTO v_po;
 FOR v_rec IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_line:=v_rec.value;
  IF jsonb_typeof(v_line)<>'object' OR jsonb_typeof(v_line->'product_id')<>'string' THEN RAISE EXCEPTION 'Invalid item'; END IF;
  v_product:=(v_line->>'product_id')::uuid;
  v_qty:=(v_line->>'quantity')::numeric;v_cost:=(v_line->>'unit_cost')::numeric;
  IF v_product=ANY(v_seen) OR v_qty IS NULL OR v_qty<=0 OR v_qty>1000000 OR round(v_qty,3)<>v_qty OR
   v_cost IS NULL OR v_cost<0 OR v_cost>999999999 OR round(v_cost,2)<>v_cost THEN RAISE EXCEPTION 'Invalid or duplicate line'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=v_product AND business_id=p_business AND active AND track_inventory) THEN RAISE EXCEPTION 'Tracked product unavailable'; END IF;
  v_seen:=array_append(v_seen,v_product);
  INSERT INTO public.business_purchase_items(purchase_id,product_id,quantity,unit_cost) VALUES(v_po,v_product,v_qty,v_cost);
 END LOOP;
 RETURN v_po;
END;$$;

CREATE FUNCTION public.business_receive_purchase(p_business uuid,p_purchase uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_status text;v_line record;v_current numeric;
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_has_feature(p_business,'inventory') OR
 NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager','inventory')) THEN
 RAISE EXCEPTION 'Purchasing and inventory permissions required' USING ERRCODE='42501'; END IF;
 SELECT status INTO v_status FROM public.business_purchase_orders WHERE id=p_purchase AND business_id=p_business FOR UPDATE;
 IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Purchase is not an unreceived draft'; END IF;
 FOR v_line IN SELECT i.product_id,i.quantity FROM public.business_purchase_items i WHERE i.purchase_id=p_purchase ORDER BY i.product_id LOOP
  SELECT stock_quantity INTO v_current FROM public.products WHERE id=v_line.product_id AND business_id=p_business AND active AND track_inventory FOR UPDATE;
  IF NOT FOUND OR v_current+v_line.quantity>99999999999 THEN RAISE EXCEPTION 'Product unavailable or stock limit reached'; END IF;
  UPDATE public.products SET stock_quantity=stock_quantity+v_line.quantity,updated_at=now() WHERE id=v_line.product_id AND business_id=p_business;
  INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,reference_id,notes)
  VALUES(p_business,v_line.product_id,'purchase',v_line.quantity,p_purchase,'Purchase receipt');
 END LOOP;
 UPDATE public.business_purchase_orders SET status='received',received_by=auth.uid(),received_at=now() WHERE id=p_purchase AND business_id=p_business;
 RETURN p_purchase;
END;$$;

-- Checkout: one database transaction for order, lines, optional payment and stock depletion.
-- User supplies product IDs and quantities only. Database owns prices and validates stock.
CREATE FUNCTION public.business_pos_checkout(p_business uuid,p_request uuid,p_customer uuid,p_items jsonb,p_paid boolean,p_method public.payment_method,p_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_order uuid;v_line jsonb;v_rec record;v_product uuid;v_qty numeric;v_seen uuid[]:=ARRAY[]::uuid[];
 v_row record;v_subtotal numeric(14,2):=0;v_line_total numeric(14,2);v_existing uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(SELECT 1 FROM public.business_members
 WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager','sales')) THEN
 RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'Missing checkout request identifier'; END IF;
 SELECT order_id INTO v_existing FROM public.business_pos_sales WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN RETURN v_existing; END IF;
 IF p_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_customers WHERE business_id=p_business AND customer_id=p_customer) THEN RAISE EXCEPTION 'Customer does not belong to business'; END IF;
 IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 30 OR length(coalesce(p_reference,''))>150 THEN RAISE EXCEPTION 'Invalid basket'; END IF;
 IF coalesce(p_paid,false) AND p_method NOT IN ('cash','transfer','pos','card','other') THEN RAISE EXCEPTION 'Invalid recorded payment method'; END IF;
 -- Consistent product lock ordering reduces deadlocks between concurrent checkout transactions.
 FOR v_rec IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id' LOOP
  v_line:=v_rec.value;
  IF jsonb_typeof(v_line->'product_id')<>'string' THEN RAISE EXCEPTION 'Invalid item'; END IF;
  v_product:=(v_line->>'product_id')::uuid;v_qty:=(v_line->>'quantity')::numeric;
  IF v_product=ANY(v_seen) OR v_qty IS NULL OR v_qty<=0 OR v_qty>1000000 OR round(v_qty,3)<>v_qty THEN RAISE EXCEPTION 'Invalid or duplicate POS product'; END IF;
  SELECT id,name,selling_price,cost_price,stock_quantity,track_inventory INTO v_row FROM public.products
   WHERE id=v_product AND business_id=p_business AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable or foreign product'; END IF;
  IF v_row.track_inventory AND v_row.stock_quantity<v_qty THEN RAISE EXCEPTION 'Insufficient stock for %',v_row.name; END IF;
  v_line_total:=round(v_qty*v_row.selling_price,2);
  IF v_line_total>999999999999 OR v_subtotal+v_line_total>999999999999 THEN RAISE EXCEPTION 'Sale exceeds allowed amount'; END IF;
  v_subtotal:=v_subtotal+v_line_total;v_seen:=array_append(v_seen,v_product);
 END LOOP;
 IF v_subtotal<=0 THEN RAISE EXCEPTION 'Sale must have a positive amount'; END IF;
 INSERT INTO public.orders(business_id,customer_id,order_number,status,subtotal,discount,tax,delivery_fee,notes)
 VALUES(p_business,p_customer,'POS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 CASE WHEN coalesce(p_paid,false) THEN 'completed'::public.order_status ELSE 'confirmed'::public.order_status END,
 v_subtotal,0,0,0,'Software POS sale') RETURNING id INTO v_order;
 FOR v_rec IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id' LOOP
  v_line:=v_rec.value;
  v_product:=(v_line->>'product_id')::uuid;v_qty:=(v_line->>'quantity')::numeric;
  SELECT id,name,selling_price,cost_price,track_inventory INTO v_row FROM public.products WHERE id=v_product AND business_id=p_business;
  INSERT INTO public.order_items(order_id,product_id,name_snapshot,quantity,unit_price,unit_cost)
  VALUES(v_order,v_product,v_row.name,v_qty,v_row.selling_price,v_row.cost_price);
  IF v_row.track_inventory THEN
   UPDATE public.products SET stock_quantity=stock_quantity-v_qty,updated_at=now() WHERE id=v_product AND business_id=p_business;
   INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,reference_id,notes)
   VALUES(p_business,v_product,'sale',-v_qty,v_order,'Software POS checkout');
  END IF;
 END LOOP;
 IF coalesce(p_paid,false) THEN
  INSERT INTO public.payments(business_id,order_id,customer_id,amount,method,status,reference)
  VALUES(p_business,v_order,p_customer,v_subtotal,p_method,'completed',nullif(btrim(coalesce(p_reference,'')),''));
 END IF;
 INSERT INTO public.business_pos_sales(business_id,order_id,request_id,cashier_id,payment_recorded)
 VALUES(p_business,v_order,p_request,auth.uid(),coalesce(p_paid,false));
 RETURN v_order;
END;$$;

REVOKE ALL ON FUNCTION public.business_create_supplier(uuid,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.business_create_purchase(uuid,uuid,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.business_receive_purchase(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.business_pos_checkout(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_create_supplier(uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_create_purchase(uuid,uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_receive_purchase(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_pos_checkout(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text) TO authenticated;

-- Extend all permission entry points so POS and Purchasing can be assigned per plan or business.

create or replace function public.admin_set_plan_feature(p_plan_id text,p_feature_key text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not exists(select 1 from public.platform_admins where user_id=auth.uid() and active) then
   raise exception 'Platform administrator access required';
 end if;
 if p_feature_key not in ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team','pos','purchasing') then
   raise exception 'Unknown feature';
 end if;
 insert into public.platform_plan_features(plan_id,feature_key,enabled,updated_by)
 values(p_plan_id,p_feature_key,p_enabled,auth.uid())
 on conflict(plan_id,feature_key) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
end;$$;
REVOKE ALL ON FUNCTION public.admin_set_plan_feature(text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_feature(text,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_plan_role_feature(
 p_plan_id text,p_feature_key text,p_role text,p_enabled boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
  RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501';
 END IF;
 IF p_feature_key NOT IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team','pos','purchasing')
    OR p_role NOT IN ('owner','manager','sales','inventory','finance','staff') THEN
  RAISE EXCEPTION 'Invalid module or business role';
 END IF;
 IF p_role='owner' AND NOT p_enabled THEN
  RAISE EXCEPTION 'The business owner must retain access to enabled plan modules';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.public_site_plans WHERE id=p_plan_id) THEN
  RAISE EXCEPTION 'Plan not found';
 END IF;
 INSERT INTO public.platform_plan_role_features(plan_id,feature_key,role,enabled,updated_by)
 VALUES(p_plan_id,p_feature_key,p_role::public.member_role,p_enabled,auth.uid())
 ON CONFLICT(plan_id,feature_key,role) DO UPDATE
 SET enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=now();
END;$$;
REVOKE ALL ON FUNCTION public.admin_set_plan_role_feature(text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_role_feature(text,text,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_plan_permissions(
 p_plan_id text,p_features jsonb,p_role_features jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_key text;
 v_role text;
 v_enabled boolean;
 v_roles jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
  RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.public_site_plans WHERE id=p_plan_id) THEN
  RAISE EXCEPTION 'Unknown plan';
 END IF;
 IF jsonb_typeof(p_features)<>'object' OR jsonb_typeof(p_role_features)<>'object' THEN
  RAISE EXCEPTION 'Invalid permission payload';
 END IF;
 FOREACH v_key IN ARRAY ARRAY['accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team','pos','purchasing'] LOOP
  IF p_features->>v_key NOT IN ('true','false') THEN
   RAISE EXCEPTION 'Invalid plan permission: %',v_key;
  END IF;
  v_enabled=(p_features->>v_key)::boolean;
  INSERT INTO public.platform_plan_features(plan_id,feature_key,enabled,updated_by)
  VALUES(p_plan_id,v_key,v_enabled,auth.uid())
  ON CONFLICT(plan_id,feature_key) DO UPDATE
   SET enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=now();
  v_roles=p_role_features->v_key;
  IF jsonb_typeof(v_roles)<>'array' THEN RAISE EXCEPTION 'Invalid role list: %',v_key; END IF;
  FOREACH v_role IN ARRAY ARRAY['manager','finance','sales','inventory','staff'] LOOP
   INSERT INTO public.platform_plan_role_features(plan_id,feature_key,role,enabled,updated_by)
   VALUES(p_plan_id,v_key,v_role::public.member_role,v_roles ? v_role,auth.uid())
   ON CONFLICT(plan_id,feature_key,role) DO UPDATE
    SET enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=now();
  END LOOP;
 END LOOP;
END;$$;
REVOKE ALL ON FUNCTION public.admin_save_plan_permissions(text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_plan_permissions(text,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_business_feature_grant(
 p_business uuid,p_feature text,p_enabled boolean,p_roles text[],p_expires_at timestamptz,p_note text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_prev jsonb;v_next jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
  RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business) THEN RAISE EXCEPTION 'Business not found'; END IF;
 IF p_feature NOT IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team','pos','purchasing') THEN RAISE EXCEPTION 'Unknown feature'; END IF;
 IF p_roles IS NULL OR cardinality(p_roles) NOT BETWEEN 1 AND 6 OR NOT ('owner'=ANY(p_roles))
 OR EXISTS(SELECT 1 FROM unnest(p_roles) r WHERE r IS NULL OR r NOT IN ('owner','manager','finance','sales','inventory','staff'))
 THEN RAISE EXCEPTION 'Select valid business roles including Owner'; END IF;
 IF p_note IS NULL OR length(p_note)>1000 THEN RAISE EXCEPTION 'Invalid change note'; END IF;
 IF p_enabled AND p_expires_at IS NOT NULL AND p_expires_at<=now() THEN RAISE EXCEPTION 'Grant expiration must be in the future'; END IF;
 SELECT to_jsonb(g) INTO v_prev FROM public.business_feature_grants g WHERE business_id=p_business AND feature_key=p_feature FOR UPDATE;
 INSERT INTO public.business_feature_grants(business_id,feature_key,enabled,allowed_roles,expires_at,note,updated_by)
 VALUES(p_business,p_feature,p_enabled,p_roles::public.member_role[],p_expires_at,p_note,auth.uid())
 ON CONFLICT(business_id,feature_key) DO UPDATE SET enabled=EXCLUDED.enabled,allowed_roles=EXCLUDED.allowed_roles,
 expires_at=EXCLUDED.expires_at,note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=now();
 SELECT to_jsonb(g) INTO v_next FROM public.business_feature_grants g WHERE business_id=p_business AND feature_key=p_feature;
 INSERT INTO public.business_feature_grant_audit(business_id,feature_key,before_value,after_value,changed_by)
 VALUES(p_business,p_feature,v_prev,v_next,auth.uid());
END;$$;
REVOKE ALL ON FUNCTION public.admin_set_business_feature_grant(uuid,text,boolean,text[],timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_business_feature_grant(uuid,text,boolean,text[],timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_has_feature(p_business_id uuid,p_feature_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_plan text;v_role public.member_role;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business_id AND user_id=auth.uid();
 IF v_role IS NULL THEN RETURN false; END IF;
 IF p_feature_key IN ('dashboard','customers','orders','payments','expenses','products','settings','upgrade') THEN RETURN true; END IF;
 IF p_feature_key NOT IN ('accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team','pos','purchasing') THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.business_feature_grants g WHERE g.business_id=p_business_id AND g.feature_key=p_feature_key
  AND g.enabled AND (g.expires_at IS NULL OR g.expires_at>now()) AND v_role=ANY(g.allowed_roles)) THEN RETURN true; END IF;
 SELECT plan_id INTO v_plan FROM public.business_plan_assignments WHERE business_id=p_business_id;
 IF v_plan IS NULL THEN RETURN false; END IF;
 RETURN EXISTS (
  WITH RECURSIVE family(plan_id,depth) AS (
    SELECT v_plan,0 UNION ALL
    SELECT parent.parent_plan_id,f.depth+1 FROM family f JOIN public.plan_parent_links parent ON parent.plan_id=f.plan_id WHERE f.depth<32
  )
  SELECT 1 FROM family f JOIN public.platform_plan_features pf ON pf.plan_id=f.plan_id
  WHERE pf.feature_key=p_feature_key AND pf.enabled AND (
    v_role='owner'
    OR EXISTS(SELECT 1 FROM public.platform_plan_role_features pr WHERE pr.plan_id=f.plan_id
      AND pr.feature_key=p_feature_key AND pr.role=v_role AND pr.enabled)
    OR (NOT EXISTS(SELECT 1 FROM public.platform_plan_role_features pr WHERE pr.plan_id=f.plan_id
      AND pr.feature_key=p_feature_key AND pr.role=v_role)
      AND CASE p_feature_key
        WHEN 'accounting' THEN v_role IN ('manager','finance')
        WHEN 'tax' THEN v_role IN ('manager','finance')
        WHEN 'financial_reports' THEN v_role IN ('manager','finance')
        WHEN 'communications' THEN v_role IN ('manager','sales')
        WHEN 'campaigns' THEN v_role='manager'
        WHEN 'inventory' THEN v_role IN ('manager','inventory')
        WHEN 'pos' THEN v_role IN ('manager','sales')
        WHEN 'purchasing' THEN v_role IN ('manager','inventory')
        WHEN 'insights' THEN v_role IN ('manager','finance')
        WHEN 'growth' THEN v_role='manager'
        ELSE false END)
  ) LIMIT 1
 );
END;$$;
REVOKE ALL ON FUNCTION public.business_has_feature(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_has_feature(uuid,text) TO authenticated;

COMMIT;
