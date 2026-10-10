-- Phase 030H. NGN-only, reviewed-VAT POS price modes and pre-tax basket discounts.
-- Apply once after 033. Additive: historical orders/invoices are not altered.
-- IMPORTANT: No delivery fee, mixed VAT-inclusive modes per item, refunds or card settlement.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_pos_tax_lines') IS NULL OR
    to_regclass('public.business_product_tax_mappings') IS NULL OR
    to_regclass('public.business_invoices') IS NULL THEN
   RAISE EXCEPTION 'Apply SQL 033 first';
 END IF;
 IF to_regclass('public.business_pos_pricing_contexts') IS NOT NULL THEN
   RAISE EXCEPTION 'SQL 034 already installed or partially installed; inspect before rerunning';
 END IF;
END $$;

CREATE TABLE public.business_pos_pricing_contexts (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 price_mode text NOT NULL CHECK (price_mode IN ('exclusive','inclusive')),
 subtotal_before_discount numeric(14,2) NOT NULL CHECK (subtotal_before_discount>0),
 discount_before_vat numeric(14,2) NOT NULL CHECK (discount_before_vat>=0),
 vat_amount numeric(14,2) NOT NULL CHECK (vat_amount>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE INDEX business_pos_pricing_business_idx ON public.business_pos_pricing_contexts(business_id,created_at DESC);
ALTER TABLE public.business_pos_pricing_contexts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_pos_pricing_contexts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_pos_pricing_contexts TO authenticated;
CREATE POLICY pos_pricing_read ON public.business_pos_pricing_contexts FOR SELECT TO authenticated
 USING(public.is_business_member(business_id));

CREATE FUNCTION public.business_pos_checkout_priced(
 p_business uuid,p_request uuid,p_customer uuid,p_items jsonb,p_paid boolean,
 p_method public.payment_method,p_reference text,p_price_mode text,p_discount numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_rec record;v_line jsonb;v_item jsonb;v_product uuid;v_qty numeric;v_row record;
 v_mapping uuid;v_rule_id_text text;v_treatment text;v_rate integer;v_count int;
 v_unit_net numeric(14,2);v_base numeric(14,2);v_line_discount numeric(14,2);v_after numeric(14,2);
 v_line_vat numeric(14,2);v_subtotal numeric(14,2):=0;v_vat numeric(14,2):=0;
 v_discount_remaining numeric(14,2);v_remaining_base numeric(14,2);v_index int:=0;v_size int;
 v_order uuid;v_existing uuid;v_date date:=(now() AT TIME ZONE 'Africa/Lagos')::date;
 v_items jsonb:='[]'::jsonb;v_processed jsonb:='[]'::jsonb;v_currency text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
    AND role IN ('owner','manager','sales')) THEN
   RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_tax_profiles WHERE business_id=p_business
  AND vat_registration_status='registered' AND classification_status='reviewed') THEN
   RAISE EXCEPTION 'A reviewed VAT-registered profile is required';
 END IF;
 SELECT currency INTO v_currency FROM public.businesses WHERE id=p_business;
 IF v_currency IS DISTINCT FROM 'NGN' THEN RAISE EXCEPTION 'Reviewed pricing supports NGN only'; END IF;
 IF p_price_mode NOT IN ('exclusive','inclusive') OR p_price_mode IS NULL THEN
   RAISE EXCEPTION 'Select VAT-inclusive or VAT-exclusive catalogue prices'; END IF;
 IF p_discount IS NULL OR p_discount<0 OR p_discount>999999999999 OR round(p_discount,2)<>p_discount THEN
   RAISE EXCEPTION 'Enter a valid pre-tax discount (2 decimal places)'; END IF;
 IF p_request IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 30
  OR length(coalesce(p_reference,''))>150 THEN RAISE EXCEPTION 'Invalid checkout request'; END IF;
 IF coalesce(p_paid,false) AND p_method NOT IN ('cash','transfer','pos','card','other') THEN
   RAISE EXCEPTION 'Invalid recorded payment method'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_business::text||':'||p_request::text,0));
 SELECT order_id INTO v_existing FROM public.business_pos_sales
  WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN RETURN v_existing; END IF;
 IF p_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_customers
  WHERE business_id=p_business AND customer_id=p_customer) THEN
   RAISE EXCEPTION 'Customer belongs to another business'; END IF;

 -- Lock every product in deterministic order to avoid overselling and reduce deadlocks.
 FOR v_rec IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id' LOOP
  v_line:=v_rec.value;
  IF jsonb_typeof(v_line->'product_id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(v_line->'quantity') IS DISTINCT FROM 'number' THEN
   RAISE EXCEPTION 'Invalid POS item'; END IF;
  v_product:=(v_line->>'product_id')::uuid;v_qty:=(v_line->>'quantity')::numeric;
  IF v_qty IS NULL OR v_qty<=0 OR v_qty>1000000 OR round(v_qty,3)<>v_qty
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_items) AS t(value)
        WHERE t.value->>'product_id'=v_product::text) THEN
   RAISE EXCEPTION 'Duplicate item or invalid quantity'; END IF;
  SELECT id,name,selling_price,cost_price,stock_quantity,track_inventory INTO v_row
  FROM public.products WHERE id=v_product AND business_id=p_business AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable or foreign product'; END IF;
  IF v_row.track_inventory AND v_row.stock_quantity<v_qty THEN
    RAISE EXCEPTION 'Insufficient stock for %',v_row.name; END IF;
  SELECT supply_id INTO v_mapping FROM public.business_product_tax_mappings
    WHERE product_id=v_product AND business_id=p_business;
  IF v_mapping IS NULL THEN RAISE EXCEPTION 'Product % lacks a reviewed supply mapping',v_row.name; END IF;
  SELECT count(*),min(r.id::text),min(r.treatment),min(r.rate_basis_points)
   INTO v_count,v_rule_id_text,v_treatment,v_rate
  FROM public.business_tax_assignments a JOIN public.tax_rule_versions r ON r.id=a.rule_version_id
  WHERE a.business_id=p_business AND a.supply_id=v_mapping AND a.status='approved'
    AND r.status='approved' AND r.tax_kind='vat' AND r.effective_from<=v_date
    AND (r.effective_to IS NULL OR r.effective_to>=v_date);
  IF v_count<>1 OR NOT ((v_treatment='standard' AND v_rate=750)
     OR (v_treatment IN ('zero_rated','exempt','outside_scope') AND v_rate=0)) THEN
    RAISE EXCEPTION 'Product % lacks one currently approved VAT rule',v_row.name; END IF;
  -- Catalogue prices are stored to two decimal places. Inclusive mode extracts
  -- VAT from the UNIT price and stores the resulting NET unit in order_items.
  v_unit_net:=CASE WHEN p_price_mode='inclusive'
   THEN round(v_row.selling_price*10000/(10000+v_rate),2)
   ELSE round(v_row.selling_price,2) END;
  v_base:=round(v_qty*v_unit_net,2);
  IF v_base<0 OR v_base>999999999999 OR v_subtotal+v_base>999999999999 THEN
    RAISE EXCEPTION 'Invalid or oversized sale'; END IF;
  v_subtotal:=v_subtotal+v_base;
  v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'product_id',v_product,'name',v_row.name,'quantity',v_qty,'unit_net',v_unit_net,
    'unit_cost',v_row.cost_price,'track_inventory',v_row.track_inventory,
    'supply_id',v_mapping,'rule_version_id',v_rule_id_text,
    'treatment',v_treatment,'rate',v_rate,'base',v_base));
 END LOOP;
 IF v_subtotal<=0 OR p_discount>=v_subtotal THEN
   RAISE EXCEPTION 'Discount must be smaller than the pre-tax subtotal'; END IF;
 v_discount_remaining:=p_discount;v_remaining_base:=v_subtotal;v_size:=jsonb_array_length(v_items);
 -- Allocate the discount across items proportionally. The final item receives
 -- the rounding residual; we reject any allocation that would exceed its base.
 FOR v_rec IN SELECT value FROM jsonb_array_elements(v_items) LOOP
  v_item:=v_rec.value;v_index:=v_index+1;v_base:=(v_item->>'base')::numeric;
  v_line_discount:=CASE WHEN v_index=v_size THEN v_discount_remaining
    ELSE GREATEST(0,v_discount_remaining-(v_remaining_base-v_base),
      LEAST(v_base,v_discount_remaining,round(p_discount*v_base/v_subtotal,2))) END;
  IF v_line_discount<0 OR v_line_discount>v_base THEN
    RAISE EXCEPTION 'Discount allocation cannot be reconciled'; END IF;
  v_discount_remaining:=v_discount_remaining-v_line_discount;
  v_remaining_base:=v_remaining_base-v_base;
  v_after:=v_base-v_line_discount;
  v_line_vat:=round(v_after*(v_item->>'rate')::integer/10000,2);
  v_vat:=v_vat+v_line_vat;
  v_processed:=v_processed||jsonb_build_array(v_item||jsonb_build_object(
    'discount',v_line_discount,'taxable_base',v_after,'vat',v_line_vat));
 END LOOP;
 IF v_discount_remaining<>0 OR v_subtotal-p_discount+v_vat>999999999999 THEN
  RAISE EXCEPTION 'Cannot reconcile checkout amounts'; END IF;

 INSERT INTO public.orders(business_id,customer_id,order_number,status,subtotal,discount,tax,delivery_fee,notes)
 VALUES(p_business,p_customer,'POS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  CASE WHEN coalesce(p_paid,false) THEN 'completed'::public.order_status ELSE 'confirmed'::public.order_status END,
  v_subtotal,p_discount,v_vat,0,'Reviewed POS sale; advanced price mode and pre-tax discount')
 RETURNING id INTO v_order;
 FOR v_rec IN SELECT value FROM jsonb_array_elements(v_processed) LOOP
  v_item:=v_rec.value;v_product:=(v_item->>'product_id')::uuid;v_qty:=(v_item->>'quantity')::numeric;
  INSERT INTO public.order_items(order_id,product_id,name_snapshot,quantity,unit_price,unit_cost)
  VALUES(v_order,v_product,v_item->>'name',v_qty,(v_item->>'unit_net')::numeric,(v_item->>'unit_cost')::numeric);
  INSERT INTO public.business_pos_tax_lines(business_id,order_id,product_id,product_name,supply_id,rule_version_id,
    treatment,rate_basis_points,quantity,taxable_base,vat_amount,assessed_on)
  VALUES(p_business,v_order,v_product,v_item->>'name',(v_item->>'supply_id')::uuid,
   (v_item->>'rule_version_id')::uuid,v_item->>'treatment',(v_item->>'rate')::integer,
   v_qty,(v_item->>'taxable_base')::numeric,(v_item->>'vat')::numeric,v_date);
  IF (v_item->>'track_inventory')::boolean THEN
    UPDATE public.products SET stock_quantity=stock_quantity-v_qty,updated_at=now()
     WHERE id=v_product AND business_id=p_business;
    INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,reference_id,notes)
    VALUES(p_business,v_product,'sale',-v_qty,v_order,'Reviewed POS pricing checkout');
  END IF;
 END LOOP;
 IF coalesce(p_paid,false) THEN
  INSERT INTO public.payments(business_id,order_id,customer_id,amount,method,status,reference)
  VALUES(p_business,v_order,p_customer,v_subtotal-p_discount+v_vat,p_method,'completed',nullif(btrim(coalesce(p_reference,'')),''));
 END IF;
 INSERT INTO public.business_pos_sales(business_id,order_id,request_id,cashier_id,payment_recorded)
 VALUES(p_business,v_order,p_request,auth.uid(),coalesce(p_paid,false));
 INSERT INTO public.business_pos_pricing_contexts(order_id,business_id,price_mode,
    subtotal_before_discount,discount_before_vat,vat_amount,created_by)
 VALUES(v_order,p_business,p_price_mode,v_subtotal,p_discount,v_vat,auth.uid());
 RETURN v_order;
END $$;
REVOKE ALL ON FUNCTION public.business_pos_checkout_priced(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text,text,numeric)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_pos_checkout_priced(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text,text,numeric)
 TO authenticated;

-- New issued invoices snapshot price basis at issuance, preserving old invoices.
CREATE FUNCTION public.attach_pos_pricing_invoice_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ctx record;
BEGIN
 SELECT price_mode,subtotal_before_discount,discount_before_vat,vat_amount INTO v_ctx
 FROM public.business_pos_pricing_contexts WHERE order_id=NEW.order_id AND business_id=NEW.business_id;
 IF FOUND THEN
  IF round(coalesce((NEW.snapshot->>'subtotal')::numeric,0),2)<>v_ctx.subtotal_before_discount
     OR round(coalesce((NEW.snapshot->>'discount')::numeric,0),2)<>v_ctx.discount_before_vat
     OR round(coalesce((NEW.snapshot->>'tax_recorded')::numeric,0),2)<>v_ctx.vat_amount THEN
    RAISE EXCEPTION 'Invoice pricing does not match reviewed POS checkout'; END IF;
  NEW.snapshot:=NEW.snapshot||jsonb_build_object('pos_pricing_context',jsonb_build_object(
   'price_mode',v_ctx.price_mode,'discount_before_vat',v_ctx.discount_before_vat,
   'subtotal_before_discount',v_ctx.subtotal_before_discount));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.attach_pos_pricing_invoice_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER invoice_pos_pricing_at_issue BEFORE INSERT ON public.business_invoices
 FOR EACH ROW EXECUTE FUNCTION public.attach_pos_pricing_invoice_snapshot();
COMMIT;
