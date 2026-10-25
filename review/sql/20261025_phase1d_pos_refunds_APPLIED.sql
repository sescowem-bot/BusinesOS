-- BusinessOS Phase 1D POS and refunds, original routine bodies preserved; atomic.
BEGIN;
CREATE OR REPLACE FUNCTION public.business_add_pos_cash_movement(p_business uuid, p_shift uuid, p_kind text, p_amount numeric, p_reason text, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','edit') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager','sales')) THEN
  RAISE EXCEPTION 'Cashier permission required' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN ('cash_in','cash_out') OR p_amount IS NULL OR p_amount<=0 OR
    p_amount>999999999999.99 OR round(p_amount,2)<>p_amount OR
    length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500 OR
    length(btrim(coalesce(p_reference,''))) NOT BETWEEN 3 AND 150 THEN
  RAISE EXCEPTION 'A valid cash movement, explanation and unique reference are required'; END IF;
 PERFORM 1 FROM public.business_pos_cashier_shifts WHERE id=p_shift AND business_id=p_business
  AND cashier_id=auth.uid() AND status='open' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only the cashier may record movements on their open shift'; END IF;
 INSERT INTO public.business_pos_cash_movements(business_id,shift_id,kind,amount,reason,reference,recorded_by)
 VALUES(p_business,p_shift,p_kind,p_amount,btrim(p_reason),btrim(p_reference),auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.business_close_pos_shift(p_business uuid, p_shift uuid, p_counted numeric, p_note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_shift record;v_receipts numeric(14,2);v_in numeric(14,2);v_out numeric(14,2);v_expected numeric(14,2);
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','edit') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 IF p_counted IS NULL OR p_counted<0 OR p_counted>999999999999.99 OR
    round(p_counted,2)<>p_counted OR length(coalesce(p_note,''))>500 THEN
  RAISE EXCEPTION 'Count cash carefully and enter a valid closing note'; END IF;
 SELECT * INTO v_shift FROM public.business_pos_cashier_shifts
 WHERE id=p_shift AND business_id=p_business AND cashier_id=auth.uid() AND status='open' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only the active cashier may close their open shift'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_receipts FROM public.business_pos_shift_receipts WHERE shift_id=p_shift;
 SELECT coalesce(sum(amount) FILTER(WHERE kind='cash_in'),0),
        coalesce(sum(amount) FILTER(WHERE kind='cash_out'),0)
 INTO v_in,v_out FROM public.business_pos_cash_movements WHERE shift_id=p_shift;
 v_expected:=v_shift.opening_cash+v_receipts+v_in-v_out;
 IF v_expected<0 THEN RAISE EXCEPTION 'Cash out exceeds all recorded available cash; reconcile before close'; END IF;
 UPDATE public.business_pos_cashier_shifts SET status='closed',closed_at=now(),
  counted_cash=p_counted,sales_cash_total=v_receipts,cash_in_total=v_in,cash_out_total=v_out,
  expected_cash=v_expected,variance=p_counted-v_expected,close_note=nullif(btrim(coalesce(p_note,'')),'')
 WHERE id=p_shift AND business_id=p_business;
 RETURN p_shift;
END $function$
;

CREATE OR REPLACE FUNCTION public.business_complete_pos_return(p_business uuid, p_return uuid, p_method text, p_reference text, p_restock boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row record;v_sale record;v_item record;v_product record;v_note uuid;v_document text;
 v_tax_treatment text;v_tax_rate integer;v_original_invoice text;v_brand text;v_customer text;v_identity record;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','approve') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 IF NOT public.business_plan_core_feature_allowed(p_business,'payments') OR NOT public.business_can_perform_action(p_business,'payments','edit') THEN RAISE EXCEPTION 'Refund completion permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager')) THEN
   RAISE EXCEPTION 'Owner/manager settlement permission required' USING ERRCODE='42501'; END IF;
 IF p_method NOT IN ('cash','transfer','external_pos','external_card','other') OR
   length(btrim(coalesce(p_reference,''))) NOT BETWEEN 3 AND 150 OR p_restock IS NULL THEN
  RAISE EXCEPTION 'Confirm refund method, external reference and stock disposition'; END IF;
 SELECT * INTO v_row FROM public.business_pos_returns WHERE id=p_return AND business_id=p_business FOR UPDATE;
 IF NOT FOUND OR v_row.status<>'approved' THEN RAISE EXCEPTION 'An approved, unsettled return is required'; END IF;
 SELECT * INTO v_sale FROM public.orders WHERE id=v_row.order_id AND business_id=p_business FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source order no longer exists'; END IF;
 IF v_sale.status='cancelled' THEN RAISE EXCEPTION 'Cancelled order requires independent reconciliation'; END IF;
 SELECT * INTO v_item FROM public.order_items WHERE id=v_row.order_item_id AND order_id=v_row.order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source item missing'; END IF;
 IF p_restock THEN
  IF v_item.product_id IS NULL THEN RAISE EXCEPTION 'Cannot restock a removed product'; END IF;
  SELECT id,track_inventory INTO v_product FROM public.products
    WHERE id=v_item.product_id AND business_id=p_business FOR UPDATE;
  IF NOT FOUND OR NOT v_product.track_inventory THEN
    RAISE EXCEPTION 'This item is not tracked stock; choose no restock'; END IF;
 END IF;
 SELECT treatment,rate_basis_points INTO v_tax_treatment,v_tax_rate
 FROM public.business_pos_tax_lines WHERE order_id=v_row.order_id AND product_id=v_item.product_id;
 SELECT invoice_number INTO v_original_invoice FROM public.business_invoices
 WHERE order_id=v_row.order_id AND business_id=p_business LIMIT 1;
 SELECT name INTO v_brand FROM public.businesses WHERE id=p_business;
 SELECT display_name,logo_url,registration_number,tax_identification_number,footer_note
 INTO v_identity FROM public.business_invoice_profiles WHERE business_id=p_business;
 SELECT name INTO v_customer FROM public.customers WHERE id=v_sale.customer_id;
 v_document:='CN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,14));
 INSERT INTO public.business_pos_credit_notes(business_id,return_id,credit_number,issued_by,snapshot)
 VALUES(p_business,v_row.id,v_document,auth.uid(),jsonb_build_object(
  'original_order_id',v_row.order_id,'original_order_number',v_sale.order_number,
  'original_invoice',v_original_invoice,'item_name',v_item.name_snapshot,
  'seller_name',coalesce(nullif(v_identity.display_name,''),v_brand),
  'seller_logo_url',coalesce(v_identity.logo_url,''),
  'seller_registration_number',coalesce(v_identity.registration_number,''),
  'seller_tin',coalesce(v_identity.tax_identification_number,''),
  'seller_footer',coalesce(v_identity.footer_note,''),
  'customer_name',coalesce(v_customer,'Walk-in customer'),
  'product_id',v_item.product_id,'quantity',v_row.quantity,'reason',v_row.reason,
  'net_credit',v_row.net_credit,'vat_credit',v_row.vat_credit,'total_credit',v_row.gross_credit,
  'vat_treatment',coalesce(v_tax_treatment,'unverified'),'vat_rate_basis_points',coalesce(v_tax_rate,0),
  'refund_method',p_method,'refund_reference',btrim(p_reference),
  'restocked',p_restock,'business_id',p_business,'currency','NGN')) RETURNING id INTO v_note;
 INSERT INTO public.business_pos_refunds(business_id,return_id,amount,method,external_reference,confirmed_by)
 VALUES(p_business,v_row.id,v_row.gross_credit,p_method,btrim(p_reference),auth.uid());
 IF p_restock THEN
  UPDATE public.products SET stock_quantity=stock_quantity+v_row.quantity,updated_at=now()
   WHERE id=v_item.product_id AND business_id=p_business;
  INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,reference_id,notes)
  VALUES(p_business,v_item.product_id,'return',v_row.quantity,v_row.id,'Saleable goods returned; source POS '||v_sale.order_number);
 END IF;
 UPDATE public.business_pos_returns SET status='completed',completed_by=auth.uid(),completed_at=now(),restocked=p_restock
 WHERE id=p_return AND business_id=p_business;
 RETURN v_note;
END $function$
;

CREATE OR REPLACE FUNCTION public.business_delete_pos_cart(p_business uuid, p_cart uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','delete') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 DELETE FROM public.business_pos_held_carts WHERE id=p_cart AND business_id=p_business AND cashier_id=auth.uid();
 RETURN FOUND;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_open_pos_shift(p_business uuid, p_opening numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','create') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager','sales')) THEN
  RAISE EXCEPTION 'Cashier permission required' USING ERRCODE='42501'; END IF;
 IF p_opening IS NULL OR p_opening<0 OR p_opening>999999999999.99 OR round(p_opening,2)<>p_opening THEN
  RAISE EXCEPTION 'Invalid opening cash amount'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business AND currency='NGN') THEN
  RAISE EXCEPTION 'This cashier reconciliation currently supports NGN businesses only'; END IF;
 INSERT INTO public.business_pos_cashier_shifts(business_id,cashier_id,opening_cash)
 VALUES(p_business,auth.uid(),p_opening) RETURNING id INTO v_id;
 RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.business_pos_checkout(p_business uuid, p_request uuid, p_customer uuid, p_items jsonb, p_paid boolean, p_method payment_method, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order uuid;v_line jsonb;v_rec record;v_product uuid;v_qty numeric;v_seen uuid[]:=ARRAY[]::uuid[];
 v_row record;v_subtotal numeric(14,2):=0;v_line_total numeric(14,2);v_existing uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','create') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 IF p_paid AND (NOT public.business_plan_core_feature_allowed(p_business,'payments') OR NOT public.business_can_perform_action(p_business,'payments','create')) THEN RAISE EXCEPTION 'Payment permission denied' USING ERRCODE='42501'; END IF;
 
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
END $function$
;

CREATE OR REPLACE FUNCTION public.business_pos_checkout_at_location(p_business uuid, p_request uuid, p_customer uuid, p_items jsonb, p_paid boolean, p_method payment_method, p_reference text, p_price_mode text, p_discount numeric, p_location uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_location public.business_stock_locations%rowtype;v_role public.member_role;v_order uuid;v_existing record;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','create') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 IF p_paid AND (NOT public.business_plan_core_feature_allowed(p_business,'payments') OR NOT public.business_can_perform_action(p_business,'payments','create')) THEN RAISE EXCEPTION 'Payment permission denied' USING ERRCODE='42501'; END IF;
 
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR v_role NOT IN ('owner','manager','sales') THEN
  RAISE EXCEPTION 'POS access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_location FROM public.business_stock_locations WHERE id=p_location AND business_id=p_business AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active stock location'; END IF;
 IF v_role='sales' AND v_location.branch_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.business_branch_members WHERE business_id=p_business
   AND branch_id=v_location.branch_id AND user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Cashier not assigned to selected branch' USING ERRCODE='42501'; END IF;
 SELECT order_id,location_id INTO v_existing FROM public.business_pos_sales
 WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF v_existing.location_id IS DISTINCT FROM p_location THEN RAISE EXCEPTION 'Checkout key already used for a different location'; END IF;
  RETURN v_existing.order_id;
 END IF;
 PERFORM set_config('businessos.stock_location',p_location::text,true);
 IF p_price_mode IS NULL THEN
  IF coalesce(p_discount,0)<>0 THEN RAISE EXCEPTION 'Discount requires approved VAT checkout'; END IF;
  v_order:=public.business_pos_checkout(p_business,p_request,p_customer,p_items,p_paid,p_method,p_reference);
 ELSE
  v_order:=public.business_pos_checkout_priced(p_business,p_request,p_customer,p_items,p_paid,p_method,p_reference,p_price_mode,p_discount);
 END IF;
 PERFORM set_config('businessos.stock_location','',true);
 UPDATE public.business_pos_sales SET location_id=p_location WHERE business_id=p_business AND order_id=v_order
 AND location_id IS NULL;
 IF NOT FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.business_pos_sales WHERE business_id=p_business AND order_id=v_order AND location_id=p_location) THEN
   RAISE EXCEPTION 'POS location could not be attributed'; END IF;
 END IF;
 RETURN v_order;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_pos_checkout_priced(p_business uuid, p_request uuid, p_customer uuid, p_items jsonb, p_paid boolean, p_method payment_method, p_reference text, p_price_mode text, p_discount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_rec record;v_line jsonb;v_item jsonb;v_product uuid;v_qty numeric;v_row record;
 v_mapping uuid;v_rule_id_text text;v_treatment text;v_rate integer;v_count int;
 v_unit_net numeric(14,2);v_base numeric(14,2);v_line_discount numeric(14,2);v_after numeric(14,2);
 v_line_vat numeric(14,2);v_subtotal numeric(14,2):=0;v_vat numeric(14,2):=0;
 v_discount_remaining numeric(14,2);v_remaining_base numeric(14,2);v_index int:=0;v_size int;
 v_order uuid;v_existing uuid;v_date date:=(now() AT TIME ZONE 'Africa/Lagos')::date;
 v_items jsonb:='[]'::jsonb;v_processed jsonb:='[]'::jsonb;v_currency text;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','create') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 IF p_paid AND (NOT public.business_plan_core_feature_allowed(p_business,'payments') OR NOT public.business_can_perform_action(p_business,'payments','create')) THEN RAISE EXCEPTION 'Payment permission denied' USING ERRCODE='42501'; END IF;
 
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
END $function$
;

CREATE OR REPLACE FUNCTION public.business_pos_checkout_reviewed(p_business uuid, p_request uuid, p_customer uuid, p_items jsonb, p_paid boolean, p_method payment_method, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_rec record;v_line jsonb;v_item jsonb;v_product uuid;v_qty numeric;
 v_row record;v_mapping uuid;v_rule_id uuid;v_treatment text;v_rate integer;v_count integer;
 v_subtotal numeric(14,2):=0;v_vat numeric(14,2):=0;v_base numeric(14,2);v_line_vat numeric(14,2);
 v_order uuid;v_existing uuid;v_date date:=(now() AT TIME ZONE 'Africa/Lagos')::date;
 v_items jsonb:='[]'::jsonb;v_currency text;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','create') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 IF p_paid AND (NOT public.business_plan_core_feature_allowed(p_business,'payments') OR NOT public.business_can_perform_action(p_business,'payments','create')) THEN RAISE EXCEPTION 'Payment permission denied' USING ERRCODE='42501'; END IF;
 
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
END $function$
;

CREATE OR REPLACE FUNCTION public.business_pos_checkout_split(p_business uuid, p_request uuid, p_customer uuid, p_items jsonb, p_tenders jsonb, p_price_mode text, p_discount numeric, p_location uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_role public.member_role;v_order uuid;v_total numeric(14,2);v_paid numeric(14,2):=0;
 v_reviewed boolean;v_registered boolean;
 v_tender jsonb;v_method text;v_amount numeric;v_reference text;
 v_fingerprint text;v_existing record;v_count integer;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','create') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 IF NOT public.business_plan_core_feature_allowed(p_business,'payments') OR NOT public.business_can_perform_action(p_business,'payments','create') THEN RAISE EXCEPTION 'Split payment permission denied' USING ERRCODE='42501'; END IF;
 
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR v_role NOT IN ('owner','manager','sales') OR NOT public.business_has_feature(p_business,'pos') THEN
  RAISE EXCEPTION 'POS access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business AND currency='NGN') THEN
  RAISE EXCEPTION 'Split POS recording currently supports NGN businesses only'; END IF;
 IF p_request IS NULL OR jsonb_typeof(p_tenders)<>'array' OR jsonb_array_length(p_tenders) NOT BETWEEN 2 AND 3 OR
  jsonb_typeof(p_items)<>'array' OR p_location IS NULL OR p_price_mode NOT IN ('inclusive','exclusive') OR
  p_discount IS NULL OR p_discount<0 OR round(p_discount,2)<>p_discount THEN
  RAISE EXCEPTION 'Invalid split checkout'; END IF;
 v_fingerprint:=md5(coalesce(p_business::text,'')||'|'||coalesce(p_customer::text,'')||'|'||
  p_items::text||'|'||p_tenders::text||'|'||p_price_mode||'|'||p_discount::text||'|'||p_location::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_business::text||':'||p_request::text,0));
 SELECT order_id,request_fingerprint INTO v_existing FROM public.business_pos_split_checkouts
  WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF v_existing.request_fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'Checkout key already used with other details'; END IF;
  RETURN v_existing.order_id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.business_pos_sales WHERE business_id=p_business AND request_id=p_request) THEN
  RAISE EXCEPTION 'Checkout key belongs to a different sale'; END IF;
 FOR v_tender IN SELECT value FROM jsonb_array_elements(p_tenders) LOOP
  IF jsonb_typeof(v_tender->'amount')<>'number' OR jsonb_typeof(v_tender->'method')<>'string' THEN
   RAISE EXCEPTION 'Invalid tender format'; END IF;
  v_method:=v_tender->>'method';v_amount:=(v_tender->>'amount')::numeric;
  v_reference:=coalesce(v_tender->>'reference','');
  IF v_method NOT IN ('cash','transfer','pos','card','other') OR v_amount IS NULL OR v_amount<=0 OR
   v_amount>999999999 OR round(v_amount,2)<>v_amount OR length(v_reference)>150 THEN
   RAISE EXCEPTION 'Invalid tender method, amount or reference'; END IF;
  v_paid:=v_paid+v_amount;
 END LOOP;
 -- The existing branch-aware RPC verifies tax, approved rules, stock, location and role.
 -- It creates an UNPAID sale first; all payments below happen inside the same transaction.
 SELECT EXISTS(SELECT 1 FROM public.business_tax_profiles WHERE business_id=p_business
  AND vat_registration_status='registered') INTO v_registered;
 SELECT EXISTS(SELECT 1 FROM public.business_tax_profiles WHERE business_id=p_business
  AND vat_registration_status='registered' AND classification_status='reviewed') INTO v_reviewed;
 IF v_registered AND NOT v_reviewed THEN RAISE EXCEPTION 'Registered VAT business requires tax review before sale'; END IF;
 IF NOT v_reviewed AND (p_price_mode<>'exclusive' OR p_discount<>0) THEN
  RAISE EXCEPTION 'Pricing options require a reviewed VAT profile'; END IF;
 v_order:=public.business_pos_checkout_at_location(p_business,p_request,p_customer,p_items,false,'other',NULL,
  CASE WHEN v_reviewed THEN p_price_mode ELSE NULL END,p_discount,p_location);
 SELECT total INTO v_total FROM public.orders WHERE id=v_order AND business_id=p_business FOR UPDATE;
 IF v_total IS NULL OR v_paid>v_total THEN RAISE EXCEPTION 'Recorded tenders exceed the verified order total'; END IF;
 FOR v_tender IN SELECT value FROM jsonb_array_elements(p_tenders) LOOP
  PERFORM public.crm_record_payment(p_business,v_order,(v_tender->>'amount')::numeric,
   (v_tender->>'method')::public.payment_method,nullif(btrim(coalesce(v_tender->>'reference','')),''));
 END LOOP;
 UPDATE public.business_pos_sales SET payment_recorded=true WHERE order_id=v_order AND business_id=p_business;
 IF v_paid=v_total THEN
  UPDATE public.orders SET status='completed'::public.order_status,updated_at=now() WHERE id=v_order AND business_id=p_business;
 END IF;
 INSERT INTO public.business_pos_split_checkouts(business_id,request_id,order_id,request_fingerprint)
 VALUES(p_business,p_request,v_order,v_fingerprint);
 RETURN v_order;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_request_pos_return(p_business uuid, p_order uuid, p_item uuid, p_quantity numeric, p_reason text, p_request uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order record;v_line record;v_tax record;v_prior numeric(14,3);
 v_paid numeric(14,2);v_tax_count integer;v_item_count integer;
 v_net_total numeric(14,2);v_vat_total numeric(14,2);
 v_net numeric(14,2);v_vat numeric(14,2);v_id uuid;v_previous uuid;v_currency text;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','create') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager','sales')) THEN
  RAISE EXCEPTION 'POS return request permission required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_order IS NULL OR p_item IS NULL OR p_quantity IS NULL OR
    p_quantity<=0 OR p_quantity>1000000 OR round(p_quantity,3)<>p_quantity OR
    length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500 THEN
  RAISE EXCEPTION 'Invalid return quantity, reference or reason'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_business::text||':'||p_request::text,0));
 SELECT id INTO v_previous FROM public.business_pos_returns WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN RETURN v_previous; END IF;
 SELECT currency INTO v_currency FROM public.businesses WHERE id=p_business;
 IF v_currency IS DISTINCT FROM 'NGN' THEN RAISE EXCEPTION 'POS credit notes currently support NGN sales only'; END IF;
 SELECT o.id,o.total,o.status,o.discount,o.tax,o.delivery_fee,o.subtotal
 INTO v_order FROM public.orders o JOIN public.business_pos_sales s
  ON s.order_id=o.id AND s.business_id=o.business_id
 WHERE o.id=p_order AND o.business_id=p_business FOR UPDATE OF o;
 IF NOT FOUND OR v_order.status='cancelled' THEN RAISE EXCEPTION 'Only valid non-cancelled POS orders can be returned'; END IF;
 SELECT * INTO v_line FROM public.order_items WHERE id=p_item AND order_id=p_order FOR UPDATE;
 IF NOT FOUND OR v_line.product_id IS NULL THEN RAISE EXCEPTION 'Sale item is not available for an auditable return'; END IF;
 IF EXISTS(SELECT 1 FROM public.business_pos_returns WHERE order_item_id=p_item AND status IN ('requested','approved')) THEN
  RAISE EXCEPTION 'An open return already exists for this sale item'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments
 WHERE business_id=p_business AND order_id=p_order AND status='completed';
 IF v_paid<>v_order.total OR v_paid<=0 THEN
  RAISE EXCEPTION 'Returns currently require a fully paid POS sale with reconciled recorded payments'; END IF;
 IF v_order.delivery_fee<>0 THEN RAISE EXCEPTION 'Delivery-charge refunds require separate reviewed tax handling'; END IF;
 SELECT count(*) INTO v_item_count FROM public.order_items WHERE order_id=p_order;
 SELECT count(*) INTO v_tax_count FROM public.business_pos_tax_lines WHERE order_id=p_order AND business_id=p_business;
 IF v_tax_count>0 THEN
  IF v_tax_count<>v_item_count OR EXISTS(
    SELECT 1 FROM public.order_items oi LEFT JOIN public.business_pos_tax_lines tl
    ON tl.order_id=oi.order_id AND tl.product_id=oi.product_id
    WHERE oi.order_id=p_order AND (tl.product_id IS NULL OR tl.quantity<>oi.quantity)
  ) OR (SELECT coalesce(sum(taxable_base),0) FROM public.business_pos_tax_lines WHERE order_id=p_order)<>v_order.subtotal-v_order.discount
    OR (SELECT coalesce(sum(vat_amount),0) FROM public.business_pos_tax_lines WHERE order_id=p_order)<>v_order.tax THEN
   RAISE EXCEPTION 'The POS VAT allocation does not reconcile; review before returning'; END IF;
  SELECT taxable_base,vat_amount INTO v_tax FROM public.business_pos_tax_lines
   WHERE order_id=p_order AND product_id=v_line.product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing recorded POS tax evidence'; END IF;
  v_net_total:=v_tax.taxable_base;v_vat_total:=v_tax.vat_amount;
 ELSE
  IF v_order.tax<>0 OR v_order.discount<>0 OR v_order.subtotal<>v_order.total THEN
    RAISE EXCEPTION 'Unsupported legacy POS tax/discount allocation; manual review required'; END IF;
  v_net_total:=v_line.line_total;v_vat_total:=0;
 END IF;
 SELECT coalesce(sum(quantity),0) INTO v_prior FROM public.business_pos_returns
 WHERE order_item_id=p_item AND status='completed';
 IF v_prior+p_quantity>v_line.quantity THEN RAISE EXCEPTION 'Return exceeds the remaining sold quantity'; END IF;
 v_net:=round(v_net_total*(v_prior+p_quantity)/v_line.quantity,2)-round(v_net_total*v_prior/v_line.quantity,2);
 v_vat:=round(v_vat_total*(v_prior+p_quantity)/v_line.quantity,2)-round(v_vat_total*v_prior/v_line.quantity,2);
 IF v_net+v_vat<=0 THEN RAISE EXCEPTION 'The calculated credit is zero; manual review required'; END IF;
 INSERT INTO public.business_pos_returns(business_id,request_id,order_id,order_item_id,quantity,net_credit,vat_credit,reason,requested_by)
 VALUES(p_business,p_request,p_order,p_item,p_quantity,v_net,v_vat,btrim(p_reason),auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.business_review_pos_return(p_business uuid, p_return uuid, p_approve boolean, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row record;v_role text;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','approve') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR
    v_role NOT IN ('owner','manager') THEN
  RAISE EXCEPTION 'Owner or manager approval required' USING ERRCODE='42501'; END IF;
 IF p_approve IS NULL OR length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 SELECT * INTO v_row FROM public.business_pos_returns WHERE id=p_return AND business_id=p_business FOR UPDATE;
 IF NOT FOUND OR v_row.status<>'requested' THEN RAISE EXCEPTION 'This request is no longer awaiting review'; END IF;
 IF v_row.requested_by=auth.uid() AND v_role<>'owner' THEN
  RAISE EXCEPTION 'Managers cannot approve their own requests'; END IF;
 UPDATE public.business_pos_returns SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(btrim(coalesce(p_note,'')),'')
 WHERE id=p_return AND business_id=p_business;
END $function$
;

CREATE OR REPLACE FUNCTION public.business_review_pos_shift(p_business uuid, p_shift uuid, p_approve boolean, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_s record;v_role text;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','approve') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 
 SELECT role::text INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR v_role NOT IN ('owner','manager') THEN
  RAISE EXCEPTION 'Only owner or manager may review a closed shift' USING ERRCODE='42501'; END IF;
 IF p_approve IS NULL OR length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 SELECT * INTO v_s FROM public.business_pos_cashier_shifts WHERE id=p_shift AND business_id=p_business FOR UPDATE;
 IF NOT FOUND OR v_s.status<>'closed' THEN RAISE EXCEPTION 'Shift is not awaiting review'; END IF;
 IF v_s.cashier_id=auth.uid() AND v_role<>'owner' THEN
  RAISE EXCEPTION 'Manager cannot approve their own shift'; END IF;
 IF (v_s.variance<>0 OR NOT p_approve) AND length(btrim(coalesce(p_note,'')))<10 THEN
  RAISE EXCEPTION 'Explain cash variances or flagged reviews in at least 10 characters'; END IF;
 UPDATE public.business_pos_cashier_shifts SET status=CASE WHEN p_approve THEN 'reviewed' ELSE 'flagged' END,
  reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(btrim(coalesce(p_note,'')),'')
 WHERE id=p_shift AND business_id=p_business;
END $function$
;

CREATE OR REPLACE FUNCTION public.business_save_pos_cart(p_business uuid, p_cart uuid, p_label text, p_location uuid, p_customer uuid, p_basket jsonb, p_price_mode text, p_discount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;v_role public.member_role;v_item jsonb;v_qty numeric;v_product uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','create') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR v_role NOT IN ('owner','manager','sales') THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 IF p_cart IS NULL OR length(btrim(coalesce(p_label,''))) NOT BETWEEN 2 AND 80 OR
  p_price_mode NOT IN ('exclusive','inclusive') OR p_discount IS NULL OR
  p_discount<0 OR p_discount>999999999 OR round(p_discount,2)<>p_discount OR
  jsonb_typeof(p_basket)<>'array' OR jsonb_array_length(p_basket) NOT BETWEEN 1 AND 30 THEN
  RAISE EXCEPTION 'Invalid cart'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_stock_locations
  WHERE id=p_location AND business_id=p_business AND active) THEN RAISE EXCEPTION 'Invalid stock location'; END IF;
 IF v_role='sales' AND EXISTS(SELECT 1 FROM public.business_stock_locations
  WHERE id=p_location AND business_id=p_business AND branch_id IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.business_branch_members m WHERE m.branch_id=business_stock_locations.branch_id
    AND m.business_id=p_business AND m.user_id=auth.uid())) THEN
   RAISE EXCEPTION 'Cashier not assigned to this branch' USING ERRCODE='42501'; END IF;
 IF p_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_customers
  WHERE business_id=p_business AND customer_id=p_customer) THEN RAISE EXCEPTION 'Invalid customer'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_basket)) <>
    (SELECT count(DISTINCT (value->>'product_id')) FROM jsonb_array_elements(p_basket)) THEN
  RAISE EXCEPTION 'Duplicate cart product'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_basket) LOOP
  IF jsonb_typeof(v_item->'product_id')<>'string' OR jsonb_typeof(v_item->'quantity')<>'number' THEN
   RAISE EXCEPTION 'Invalid cart item'; END IF;
  v_product:=(v_item->>'product_id')::uuid;
  v_qty:=(v_item->>'quantity')::numeric;
  IF v_qty IS NULL OR v_qty<=0 OR v_qty>1000000 OR round(v_qty,3)<>v_qty OR
   NOT EXISTS(SELECT 1 FROM public.products WHERE id=v_product AND business_id=p_business AND active) THEN
   RAISE EXCEPTION 'Invalid cart quantity or product'; END IF;
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('pos-carts:'||p_business::text||':'||auth.uid()::text,0));
 IF EXISTS(SELECT 1 FROM public.business_pos_held_carts WHERE id=p_cart AND
  (business_id<>p_business OR cashier_id<>auth.uid())) THEN RAISE EXCEPTION 'Held cart belongs to another cashier' USING ERRCODE='42501'; END IF;
 -- Prevent unauthorised carts from being inserted via user-controlled IDs.
 IF NOT EXISTS(SELECT 1 FROM public.business_pos_held_carts WHERE id=p_cart) THEN
  IF (SELECT count(*) FROM public.business_pos_held_carts WHERE business_id=p_business AND cashier_id=auth.uid())>=20 THEN
   RAISE EXCEPTION 'Maximum 20 held carts per cashier'; END IF;
 END IF;
 INSERT INTO public.business_pos_held_carts(id,business_id,cashier_id,label,location_id,customer_id,basket,price_mode,discount)
 VALUES(p_cart,p_business,auth.uid(),btrim(p_label),p_location,p_customer,p_basket,p_price_mode,p_discount)
 ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label,location_id=EXCLUDED.location_id,
  customer_id=EXCLUDED.customer_id,basket=EXCLUDED.basket,price_mode=EXCLUDED.price_mode,
  discount=EXCLUDED.discount,updated_at=now()
 WHERE public.business_pos_held_carts.business_id=EXCLUDED.business_id
   AND public.business_pos_held_carts.cashier_id=EXCLUDED.cashier_id
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN
  RAISE EXCEPTION 'Held cart belongs to another cashier' USING ERRCODE='42501';
 END IF;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_set_product_tax_mapping(p_business uuid, p_product uuid, p_supply uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','edit') THEN RAISE EXCEPTION 'POS operation denied by plan or staff permission' USING ERRCODE='42501'; END IF;
 
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
END $function$
;
COMMIT;