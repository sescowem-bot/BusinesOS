-- Phase 030G: transactionally calculated, reviewed VAT for multi-item POS baskets.
-- Apply once after 032. Does not touch historical sales or invoices.
-- Assumes pre-approved, dated tax rules maintained through trusted administrative review.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_order_tax_reviews') IS NULL OR
    to_regclass('public.business_pos_sales') IS NULL OR
    to_regclass('public.business_tax_assignments') IS NULL THEN
  RAISE EXCEPTION 'Migrations through 032 are required';
 END IF;
 IF to_regclass('public.business_pos_tax_lines') IS NOT NULL THEN
  RAISE EXCEPTION 'Migration 033 appears already applied; inspect the database before retrying';
 END IF;
END $$;

CREATE TABLE public.business_product_tax_mappings (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 supply_id uuid NOT NULL REFERENCES public.business_supply_categories(id) ON DELETE RESTRICT,
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_product_tax_mappings_tenant ON public.business_product_tax_mappings(business_id);
ALTER TABLE public.business_product_tax_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_product_tax_mappings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_product_tax_mappings TO authenticated;
CREATE POLICY product_tax_mapping_member_read ON public.business_product_tax_mappings FOR SELECT TO authenticated
 USING(public.is_business_member(business_id));

-- Mapping an internal product to a supply category DOES NOT approve a tax rule.
CREATE FUNCTION public.business_set_product_tax_mapping(p_business uuid,p_product uuid,p_supply uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members
    WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager'))
    OR NOT public.business_has_feature(p_business,'pos') THEN
  RAISE EXCEPTION 'POS owner or manager permission required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=p_product AND business_id=p_business) OR
    NOT EXISTS(SELECT 1 FROM public.business_supply_categories WHERE id=p_supply AND business_id=p_business) THEN
  RAISE EXCEPTION 'Product and supply must belong to the same business'; END IF;
 INSERT INTO public.business_product_tax_mappings(business_id,product_id,supply_id,updated_by)
 VALUES(p_business,p_product,p_supply,auth.uid())
 ON CONFLICT(product_id) DO UPDATE SET supply_id=excluded.supply_id,updated_by=excluded.updated_by,
 updated_at=now() WHERE public.business_product_tax_mappings.business_id=p_business;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product mapping could not be updated'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.business_set_product_tax_mapping(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_set_product_tax_mapping(uuid,uuid,uuid) TO authenticated;

CREATE TABLE public.business_pos_tax_lines (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 product_name text NOT NULL,
 supply_id uuid NOT NULL REFERENCES public.business_supply_categories(id),
 rule_version_id uuid NOT NULL REFERENCES public.tax_rule_versions(id),
 treatment text NOT NULL CHECK(treatment IN ('standard','zero_rated','exempt','outside_scope')),
 rate_basis_points integer NOT NULL CHECK(rate_basis_points IN (0,750)),
 quantity numeric(14,3) NOT NULL CHECK(quantity>0),
 taxable_base numeric(14,2) NOT NULL CHECK(taxable_base>=0),
 vat_amount numeric(14,2) NOT NULL CHECK(vat_amount>=0),
 assessed_on date NOT NULL,
 PRIMARY KEY(order_id,product_id)
);
CREATE INDEX pos_tax_lines_business ON public.business_pos_tax_lines(business_id,assessed_on);
ALTER TABLE public.business_pos_tax_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_pos_tax_lines FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_pos_tax_lines TO authenticated;
CREATE POLICY pos_tax_lines_member_read ON public.business_pos_tax_lines FOR SELECT TO authenticated
 USING(public.is_business_member(business_id));

-- Registered businesses may not use legacy zero-tax POS, even if their reviewed profile is incomplete.
CREATE OR REPLACE FUNCTION public.business_pos_checkout(p_business uuid,p_request uuid,p_customer uuid,
 p_items jsonb,p_paid boolean,p_method public.payment_method,p_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_order uuid;v_line jsonb;v_rec record;v_product uuid;v_qty numeric;v_seen uuid[]:=ARRAY[]::uuid[];
 v_row record;v_subtotal numeric(14,2):=0;v_line_total numeric(14,2);v_existing uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.business_tax_profiles WHERE business_id=p_business AND vat_registration_status='registered') THEN
  RAISE EXCEPTION 'Registered VAT business: use reviewed-tax POS checkout, not zero-tax checkout' USING ERRCODE='P0001'; END IF;
 IF NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(SELECT 1 FROM public.business_members
 WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager','sales')) THEN
 RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'Missing checkout request identifier'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_business::text||':'||p_request::text,0));
 SELECT order_id INTO v_existing FROM public.business_pos_sales WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN RETURN v_existing; END IF;
 IF p_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_customers WHERE business_id=p_business AND customer_id=p_customer) THEN RAISE EXCEPTION 'Customer does not belong to business'; END IF;
 IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 30 OR length(coalesce(p_reference,''))>150 THEN RAISE EXCEPTION 'Invalid basket'; END IF;
 IF coalesce(p_paid,false) AND p_method NOT IN ('cash','transfer','pos','card','other') THEN RAISE EXCEPTION 'Invalid recorded payment method'; END IF;
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
 v_subtotal,0,0,0,'Software POS sale; tax treatment not verified') RETURNING id INTO v_order;
 FOR v_rec IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id' LOOP
  v_line:=v_rec.value;v_product:=(v_line->>'product_id')::uuid;v_qty:=(v_line->>'quantity')::numeric;
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
END $$;

-- Price is VAT-exclusive. No discounts or delivery in this release. Compute every line server-side.
CREATE FUNCTION public.business_pos_checkout_reviewed(p_business uuid,p_request uuid,p_customer uuid,
 p_items jsonb,p_paid boolean,p_method public.payment_method,p_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_rec record;v_line jsonb;v_item jsonb;v_product uuid;v_qty numeric;
 v_row record;v_mapping uuid;v_rule_id uuid;v_treatment text;v_rate integer;v_count integer;
 v_subtotal numeric(14,2):=0;v_vat numeric(14,2):=0;v_base numeric(14,2);v_line_vat numeric(14,2);
 v_order uuid;v_existing uuid;v_date date:=(now() AT TIME ZONE 'Africa/Lagos')::date;
 v_items jsonb:='[]'::jsonb;v_currency text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager','sales')) THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_tax_profiles WHERE business_id=p_business
    AND vat_registration_status='registered' AND classification_status='reviewed') THEN
  RAISE EXCEPTION 'A reviewed VAT-registered business profile is required'; END IF;
 SELECT currency INTO v_currency FROM public.businesses WHERE id=p_business;
 IF v_currency IS DISTINCT FROM 'NGN' THEN RAISE EXCEPTION 'Reviewed VAT checkout supports NGN only'; END IF;
 IF p_request IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 30
    OR length(coalesce(p_reference,''))>150 THEN RAISE EXCEPTION 'Invalid checkout request'; END IF;
 IF coalesce(p_paid,false) AND p_method NOT IN ('cash','transfer','pos','card','other') THEN
   RAISE EXCEPTION 'Invalid recorded payment method'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_business::text||':'||p_request::text,0));
 SELECT order_id INTO v_existing FROM public.business_pos_sales WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN RETURN v_existing; END IF;
 IF p_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_customers
    WHERE business_id=p_business AND customer_id=p_customer) THEN RAISE EXCEPTION 'Customer does not belong to business'; END IF;
 FOR v_rec IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id' LOOP
  v_line:=v_rec.value;
  IF jsonb_typeof(v_line->'product_id') IS DISTINCT FROM 'string' OR jsonb_typeof(v_line->'quantity') NOT IN ('number') THEN
   RAISE EXCEPTION 'Invalid item'; END IF;
  v_product:=(v_line->>'product_id')::uuid;v_qty:=(v_line->>'quantity')::numeric;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_items) AS t(value) WHERE t.value->>'product_id'=v_product::text) OR
     v_qty IS NULL OR v_qty<=0 OR v_qty>1000000 OR round(v_qty,3)<>v_qty THEN
     RAISE EXCEPTION 'Duplicate or invalid line'; END IF;
  SELECT id,name,selling_price,cost_price,stock_quantity,track_inventory INTO v_row FROM public.products
   WHERE id=v_product AND business_id=p_business AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable or belongs to another business'; END IF;
  IF v_row.track_inventory AND v_row.stock_quantity<v_qty THEN RAISE EXCEPTION 'Insufficient stock for %',v_row.name; END IF;
  SELECT supply_id INTO v_mapping FROM public.business_product_tax_mappings
   WHERE product_id=v_product AND business_id=p_business;
  IF v_mapping IS NULL THEN RAISE EXCEPTION 'Product % needs a reviewed tax category',v_row.name; END IF;
  -- Exactly one approved VAT rule must be effective on the checkout date.
  SELECT count(*),min(r.id::text)::uuid,min(r.treatment),min(r.rate_basis_points)
    INTO v_count,v_rule_id,v_treatment,v_rate
  FROM public.business_tax_assignments a JOIN public.tax_rule_versions r ON r.id=a.rule_version_id
  WHERE a.business_id=p_business AND a.supply_id=v_mapping AND a.status='approved'
    AND r.status='approved' AND r.tax_kind='vat' AND r.effective_from<=v_date
    AND (r.effective_to IS NULL OR r.effective_to>=v_date);
  IF v_count<>1 OR NOT ((v_treatment='standard' AND v_rate=750)
   OR (v_treatment IN ('zero_rated','exempt','outside_scope') AND v_rate=0)) THEN
   RAISE EXCEPTION 'Product % lacks one currently approved VAT rule',v_row.name; END IF;
  v_base:=round(v_qty*v_row.selling_price,2);
  IF v_base>999999999999 OR v_subtotal+v_base>999999999999 THEN RAISE EXCEPTION 'Basket too large'; END IF;
  v_line_vat:=round(v_base*v_rate/10000,2);
  v_subtotal:=v_subtotal+v_base;v_vat:=v_vat+v_line_vat;
  v_items:=v_items||jsonb_build_array(jsonb_build_object('product_id',v_product,'name',v_row.name,
   'quantity',v_qty,'unit_price',v_row.selling_price,'unit_cost',v_row.cost_price,
   'track_inventory',v_row.track_inventory,'supply_id',v_mapping,'rule_version_id',v_rule_id,
   'treatment',v_treatment,'rate_basis_points',v_rate,'base',v_base,'vat',v_line_vat));
 END LOOP;
 IF v_subtotal<=0 OR v_subtotal+v_vat>999999999999 THEN RAISE EXCEPTION 'Invalid POS total'; END IF;
 INSERT INTO public.orders(business_id,customer_id,order_number,status,subtotal,discount,tax,delivery_fee,notes)
 VALUES(p_business,p_customer,'POS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  CASE WHEN coalesce(p_paid,false) THEN 'completed'::public.order_status ELSE 'confirmed'::public.order_status END,
  v_subtotal,0,v_vat,0,'Reviewed multi-item VAT POS sale') RETURNING id INTO v_order;
 FOR v_rec IN SELECT value FROM jsonb_array_elements(v_items) LOOP
  v_item:=v_rec.value;v_product:=(v_item->>'product_id')::uuid;v_qty:=(v_item->>'quantity')::numeric;
  INSERT INTO public.order_items(order_id,product_id,name_snapshot,quantity,unit_price,unit_cost)
  VALUES(v_order,v_product,v_item->>'name',v_qty,(v_item->>'unit_price')::numeric,(v_item->>'unit_cost')::numeric);
  INSERT INTO public.business_pos_tax_lines(business_id,order_id,product_id,product_name,supply_id,rule_version_id,
   treatment,rate_basis_points,quantity,taxable_base,vat_amount,assessed_on)
  VALUES(p_business,v_order,v_product,v_item->>'name',(v_item->>'supply_id')::uuid,
   (v_item->>'rule_version_id')::uuid,v_item->>'treatment',(v_item->>'rate_basis_points')::integer,
   v_qty,(v_item->>'base')::numeric,(v_item->>'vat')::numeric,v_date);
  IF (v_item->>'track_inventory')::boolean THEN
   UPDATE public.products SET stock_quantity=stock_quantity-v_qty,updated_at=now()
   WHERE id=v_product AND business_id=p_business;
   INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,reference_id,notes)
   VALUES(p_business,v_product,'sale',-v_qty,v_order,'Reviewed VAT POS sale');
  END IF;
 END LOOP;
 IF coalesce(p_paid,false) THEN
  INSERT INTO public.payments(business_id,order_id,customer_id,amount,method,status,reference)
  VALUES(p_business,v_order,p_customer,v_subtotal+v_vat,p_method,'completed',nullif(btrim(coalesce(p_reference,'')),''));
 END IF;
 INSERT INTO public.business_pos_sales(business_id,order_id,request_id,cashier_id,payment_recorded)
 VALUES(p_business,v_order,p_request,auth.uid(),coalesce(p_paid,false));
 RETURN v_order;
END $$;
REVOKE ALL ON FUNCTION public.business_pos_checkout_reviewed(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_pos_checkout_reviewed(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text) TO authenticated;

-- The existing invoice trigger attaches seller identity. This second trigger attaches
-- the multi-line VAT evidence without altering earlier issued snapshots.
CREATE FUNCTION public.attach_pos_tax_lines_invoice_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_lines jsonb;v_sum numeric(14,2);
BEGIN
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'product_name',product_name,'treatment',treatment,'rate_basis_points',rate_basis_points,
  'taxable_base',taxable_base,'vat_amount',vat_amount,'rule_version_id',rule_version_id,
  'tax_date',assessed_on) ORDER BY product_name,product_id),'[]'::jsonb),COALESCE(sum(vat_amount),0)
 INTO v_lines,v_sum FROM public.business_pos_tax_lines WHERE order_id=NEW.order_id AND business_id=NEW.business_id;
 IF jsonb_array_length(v_lines)>0 THEN
  IF round(coalesce((NEW.snapshot->>'tax_recorded')::numeric,0),2)<>v_sum THEN
    RAISE EXCEPTION 'Invoice VAT does not match approved POS tax details'; END IF;
  NEW.snapshot:=NEW.snapshot||jsonb_build_object('pos_tax_lines',v_lines);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.attach_pos_tax_lines_invoice_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER invoice_pos_tax_details_at_issue BEFORE INSERT ON public.business_invoices
 FOR EACH ROW EXECUTE FUNCTION public.attach_pos_tax_lines_invoice_snapshot();
COMMIT;
