-- Phase 1D inventory, purchasing, accounting and catalogue direct-RPC guards. Original accounting and stock operations retained.
BEGIN;
CREATE OR REPLACE FUNCTION public.business_count_location_stock(p_business uuid, p_request uuid, p_location uuid, p_product uuid, p_expected numeric, p_counted numeric, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_balance numeric;v_total numeric;v_id uuid;v_old public.business_location_stock_counts%rowtype;
BEGIN
 IF NOT public.business_has_feature(p_business,'inventory') OR NOT public.business_can_perform_action(p_business,'inventory','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'inventory') OR NOT EXISTS
  (SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager','inventory')) THEN RAISE EXCEPTION 'Inventory role required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_location IS NULL OR p_product IS NULL OR p_expected IS NULL OR p_counted IS NULL
 OR p_expected<0 OR p_counted<0 OR p_counted>99999999999 OR round(p_expected,3)<>p_expected
 OR round(p_counted,3)<>p_counted OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Invalid location stock count'; END IF;
 SELECT stock_quantity INTO v_total FROM public.products WHERE id=p_product AND business_id=p_business
 AND active AND track_inventory FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tracked product unavailable'; END IF;
 SELECT * INTO v_old FROM public.business_location_stock_counts WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF v_old.location_id<>p_location OR v_old.product_id<>p_product OR v_old.expected_quantity<>p_expected
   OR v_old.counted_quantity<>p_counted THEN RAISE EXCEPTION 'Count key reused for different details'; END IF;
  RETURN v_old.id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_stock_locations WHERE id=p_location AND business_id=p_business AND active) THEN
  RAISE EXCEPTION 'Location unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=p_business AND m.user_id=auth.uid() AND m.role='inventory')
  AND EXISTS(SELECT 1 FROM public.business_stock_locations l WHERE l.id=p_location AND l.branch_id IS NOT NULL)
  AND NOT EXISTS(SELECT 1 FROM public.business_stock_locations l JOIN public.business_branch_members bm
    ON bm.business_id=l.business_id AND bm.branch_id=l.branch_id AND bm.user_id=auth.uid()
    WHERE l.id=p_location) THEN RAISE EXCEPTION 'Inventory staff not assigned to selected branch' USING ERRCODE='42501'; END IF;
 SELECT quantity INTO v_balance FROM public.business_location_balances
 WHERE business_id=p_business AND location_id=p_location AND product_id=p_product;
 v_balance:=coalesce(v_balance,0);
 IF v_balance<>p_expected THEN RAISE EXCEPTION 'Location stock changed. Reload and recount.' USING ERRCODE='40001'; END IF;
 IF v_total+p_counted-p_expected NOT BETWEEN 0 AND 99999999999 THEN
  RAISE EXCEPTION 'Resulting company-wide stock out of range'; END IF;
 IF p_counted<>p_expected THEN
  PERFORM set_config('businessos.stock_location',p_location::text,true);
  UPDATE public.products SET stock_quantity=v_total+p_counted-p_expected,updated_at=now()
   WHERE id=p_product AND business_id=p_business;
  PERFORM set_config('businessos.stock_location','',true);
  INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,notes)
  VALUES(p_business,p_product,'adjustment',p_counted-p_expected,'Location stock count: '||btrim(p_reason));
 END IF;
 INSERT INTO public.business_location_stock_counts(business_id,request_id,location_id,product_id,expected_quantity,counted_quantity,reason,counted_by)
 VALUES(p_business,p_request,p_location,p_product,p_expected,p_counted,btrim(p_reason),auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_create_purchase(p_business uuid, p_supplier uuid, p_items jsonb, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_po uuid;v_line jsonb;v_rec record;v_product uuid;v_qty numeric;v_cost numeric;v_seen uuid[]:=ARRAY[]::uuid[];
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_can_perform_action(p_business,'purchasing','create') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
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
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_create_supplier(p_business uuid, p_name text, p_contact text, p_phone text, p_email text, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_can_perform_action(p_business,'purchasing','create') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
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
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_delete_wholesale_price_tier(p_business uuid, p_tier uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_can_perform_action(p_business,'purchasing','delete') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
   SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager')) THEN
   RAISE EXCEPTION 'Only POS owners and managers may remove wholesale tiers' USING ERRCODE='42501'; END IF;
 DELETE FROM public.business_wholesale_price_tiers WHERE business_id=p_business AND id=p_tier;
 IF NOT FOUND THEN RAISE EXCEPTION 'Price tier not found'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.business_enable_branch_stock(p_business uuid, p_branch uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_branch public.business_branches%rowtype;v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'inventory') OR NOT public.business_can_perform_action(p_business,'inventory','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'inventory') OR NOT EXISTS
  (SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager')) THEN RAISE EXCEPTION 'Owner/manager inventory access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_branch FROM public.business_branches WHERE id=p_branch AND business_id=p_business AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active branch not found'; END IF;
 INSERT INTO public.business_stock_locations(business_id,branch_id,name)
 VALUES(p_business,p_branch,v_branch.name) ON CONFLICT(business_id,branch_id)
 DO UPDATE SET name=excluded.name,active=true RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_receive_purchase(p_business uuid, p_purchase uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_lines jsonb;v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_can_perform_action(p_business,'purchasing','edit') OR NOT public.business_has_feature(p_business,'inventory') OR NOT public.business_can_perform_action(p_business,'inventory','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'purchasing')
 OR NOT public.business_has_feature(p_business,'inventory')
 OR NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
 AND role IN ('owner','manager','inventory')) THEN
 RAISE EXCEPTION 'Purchasing and inventory access required' USING ERRCODE='42501'; END IF;
 -- The underlying function rechecks permissions and quantities under purchase lock.
 SELECT jsonb_agg(jsonb_build_object('purchase_item_id',id,'quantity',quantity-received_quantity)
 ORDER BY product_id) INTO v_lines
 FROM public.business_purchase_items WHERE purchase_id=p_purchase AND quantity>received_quantity;
 IF v_lines IS NULL THEN RAISE EXCEPTION 'No goods outstanding on this purchase'; END IF;
 v_id:=public.business_receive_purchase_partial(p_business,p_purchase,gen_random_uuid(),v_lines,'Full remaining receipt');
 RETURN p_purchase;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_receive_purchase_partial(p_business uuid, p_purchase uuid, p_request uuid, p_lines jsonb, p_note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_po public.business_purchase_orders%rowtype;v_existing uuid;v_receipt uuid;
 v_line record;v_item public.business_purchase_items%rowtype;v_product public.products%rowtype;
 v_item_id uuid;v_qty numeric;v_seen uuid[]:=ARRAY[]::uuid[];v_count integer:=0;
 v_total integer;v_done integer;
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_can_perform_action(p_business,'purchasing','edit') OR NOT public.business_has_feature(p_business,'inventory') OR NOT public.business_can_perform_action(p_business,'inventory','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'purchasing')
 OR NOT public.business_has_feature(p_business,'inventory')
 OR NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
 AND role IN ('owner','manager','inventory')) THEN
 RAISE EXCEPTION 'Purchasing and inventory access required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR length(coalesce(p_note,''))>500 OR jsonb_typeof(p_lines)<>'array'
 OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Invalid receipt'; END IF;
 -- Lock purchase first, then inspect duplicate request. No lost-quantity race.
 SELECT * INTO v_po FROM public.business_purchase_orders
 WHERE id=p_purchase AND business_id=p_business FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
 SELECT id INTO v_existing FROM public.business_purchase_receipts
 WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.business_purchase_receipts
    WHERE id=v_existing AND purchase_id=p_purchase) THEN RAISE EXCEPTION 'Request key already used for another order'; END IF;
  RETURN v_existing;
 END IF;
 IF v_po.status='received' THEN RAISE EXCEPTION 'Purchase already fully received'; END IF;
 INSERT INTO public.business_purchase_receipts(business_id,purchase_id,request_id,note,received_by)
 VALUES(p_business,p_purchase,p_request,btrim(coalesce(p_note,'')),auth.uid()) RETURNING id INTO v_receipt;
 FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) ORDER BY value->>'purchase_item_id' LOOP
  IF jsonb_typeof(v_line.value)<>'object' OR jsonb_typeof(v_line.value->'purchase_item_id')<>'string'
   OR jsonb_typeof(v_line.value->'quantity')<>'number' THEN RAISE EXCEPTION 'Invalid receipt line'; END IF;
  v_item_id:=(v_line.value->>'purchase_item_id')::uuid;
  v_qty:=(v_line.value->>'quantity')::numeric;
  IF v_item_id=ANY(v_seen) OR v_qty IS NULL OR v_qty<=0 OR v_qty>1000000
  OR round(v_qty,3)<>v_qty THEN RAISE EXCEPTION 'Duplicate or invalid receipt quantity'; END IF;
  v_seen:=array_append(v_seen,v_item_id);
  SELECT * INTO v_item FROM public.business_purchase_items
  WHERE id=v_item_id AND purchase_id=p_purchase FOR UPDATE;
  IF NOT FOUND OR v_item.received_quantity+v_qty>v_item.quantity THEN
   RAISE EXCEPTION 'Receipt exceeds unreceived purchase quantity'; END IF;
  SELECT * INTO v_product FROM public.products WHERE id=v_item.product_id AND business_id=p_business
   AND active AND track_inventory FOR UPDATE;
  IF NOT FOUND OR v_product.stock_quantity+v_qty>99999999999 THEN
   RAISE EXCEPTION 'Product not available or inventory quantity limit reached'; END IF;
  UPDATE public.business_purchase_items SET received_quantity=received_quantity+v_qty WHERE id=v_item_id;
  UPDATE public.products SET stock_quantity=stock_quantity+v_qty,updated_at=now() WHERE id=v_item.product_id AND business_id=p_business;
  INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,reference_id,notes)
  VALUES(p_business,v_item.product_id,'purchase',v_qty,v_receipt,'Partial purchase goods receipt');
  INSERT INTO public.business_purchase_receipt_lines(receipt_id,purchase_item_id,product_id,received_quantity,unit_cost_at_receipt)
  VALUES(v_receipt,v_item_id,v_item.product_id,v_qty,v_item.unit_cost);
  v_count:=v_count+1;
 END LOOP;
 IF v_count=0 THEN RAISE EXCEPTION 'At least one receipt line required'; END IF;
 SELECT count(*),count(*) FILTER (WHERE received_quantity=quantity)
 INTO v_total,v_done FROM public.business_purchase_items WHERE purchase_id=p_purchase;
 UPDATE public.business_purchase_orders SET
  status=CASE WHEN v_total=v_done THEN 'received' ELSE 'partially_received' END,
  received_by=CASE WHEN v_total=v_done THEN auth.uid() ELSE NULL END,
  received_at=CASE WHEN v_total=v_done THEN now() ELSE NULL END
 WHERE id=p_purchase AND business_id=p_business;
 RETURN v_receipt;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_record_missing_order_cost(p_business uuid, p_order uuid, p_unit_cost numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order public.orders%rowtype;v_items int;v_item_id uuid;
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'orders') OR NOT public.business_can_perform_action(p_business,'orders','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members
  WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager','finance')) THEN
  RAISE EXCEPTION 'Owner, manager or finance access required' USING ERRCODE='42501'; END IF;
 IF p_unit_cost IS NULL OR p_unit_cost<0 OR p_unit_cost>9999999999.99 OR round(p_unit_cost,2)<>p_unit_cost THEN
  RAISE EXCEPTION 'Record a valid, evidence-supported unit cost'; END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=p_order AND business_id=p_business FOR UPDATE;
 IF NOT FOUND OR v_order.status='cancelled' OR EXISTS(SELECT 1 FROM public.business_pos_sales
  WHERE business_id=p_business AND order_id=p_order) THEN
  RAISE EXCEPTION 'Only a non-cancelled manual order may receive missing cost evidence'; END IF;
 IF EXISTS(SELECT 1 FROM public.business_order_cost_evidence WHERE business_id=p_business AND order_id=p_order) THEN
  RAISE EXCEPTION 'The cost for this order was already recorded; it cannot be silently overwritten'; END IF;
 SELECT count(*),min(id::text)::uuid INTO v_items,v_item_id FROM public.order_items WHERE order_id=p_order;
 IF v_items<>1 THEN RAISE EXCEPTION 'Only single-item manual orders are supported'; END IF;
 UPDATE public.order_items SET unit_cost=p_unit_cost WHERE id=v_item_id AND order_id=p_order;
 INSERT INTO public.business_order_cost_evidence(order_id,business_id,unit_cost,recorded_by)
 VALUES(p_order,p_business,p_unit_cost,auth.uid());
END $function$
;

CREATE OR REPLACE FUNCTION public.business_record_supplier_bill(p_business uuid, p_purchase uuid, p_reference text, p_amount numeric, p_issued date, p_due date, p_note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_po public.business_purchase_orders%rowtype;v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_can_perform_action(p_business,'purchasing','create') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'purchasing')
 OR NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager'))
 THEN RAISE EXCEPTION 'Owner or manager purchasing access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_po FROM public.business_purchase_orders WHERE id=p_purchase AND business_id=p_business;
 IF NOT FOUND OR v_po.status='draft' THEN RAISE EXCEPTION 'Receive goods before recording a supplier bill'; END IF;
 IF length(btrim(coalesce(p_reference,''))) NOT BETWEEN 1 AND 100 OR p_amount IS NULL OR p_amount<=0
 OR p_amount>99999999999.99 OR round(p_amount,2)<>p_amount
 OR p_issued IS NULL OR (p_due IS NOT NULL AND p_due<p_issued) OR length(coalesce(p_note,''))>500
 THEN RAISE EXCEPTION 'Invalid supplier invoice details'; END IF;
 INSERT INTO public.business_supplier_bills(business_id,supplier_id,purchase_id,supplier_invoice_number,invoice_amount,issued_on,due_on,note,created_by)
 VALUES(p_business,v_po.supplier_id,p_purchase,btrim(p_reference),p_amount,p_issued,p_due,btrim(coalesce(p_note,'')),auth.uid())
 RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_record_supplier_payment(p_business uuid, p_bill uuid, p_request uuid, p_amount numeric, p_method text, p_reference text, p_paid_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_bill public.business_supplier_bills%rowtype;v_existing record;v_paid numeric(14,2);v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_can_perform_action(p_business,'purchasing','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'purchasing')
 OR NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager'))
 THEN RAISE EXCEPTION 'Owner or manager purchasing access required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount>99999999999.99 OR round(p_amount,2)<>p_amount
 OR p_method NOT IN ('cash','transfer','external_pos','other')
 OR length(btrim(coalesce(p_reference,''))) NOT BETWEEN 3 AND 150 OR p_paid_on IS NULL
 THEN RAISE EXCEPTION 'Invalid supplier payment'; END IF;
 SELECT * INTO v_bill FROM public.business_supplier_bills WHERE id=p_bill AND business_id=p_business FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Supplier bill not found'; END IF;
 SELECT id,bill_id INTO v_existing FROM public.business_supplier_bill_payments
  WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF v_existing.bill_id<>p_bill THEN RAISE EXCEPTION 'Request key already used on a different supplier bill'; END IF;
  RETURN v_existing.id;
 END IF;
 SELECT coalesce(sum(amount),0) INTO v_paid FROM public.business_supplier_bill_payments
 WHERE business_id=p_business AND bill_id=p_bill;
 IF v_paid+p_amount>v_bill.invoice_amount THEN RAISE EXCEPTION 'Supplier payment exceeds outstanding amount'; END IF;
 INSERT INTO public.business_supplier_bill_payments(business_id,bill_id,request_id,amount,method,reference,paid_on,recorded_by)
 VALUES(p_business,p_bill,p_request,p_amount,p_method,btrim(p_reference),p_paid_on,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_save_order_installments(p_business uuid, p_order uuid, p_count integer, p_first date, p_interval integer, p_note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;v_total numeric;v_paid numeric;v_status text;
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'orders') OR NOT public.business_can_perform_action(p_business,'orders','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members m
 WHERE m.business_id=p_business AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales'))
 THEN RAISE EXCEPTION 'Not permitted to manage customer payments' USING ERRCODE='42501'; END IF;
 IF p_count NOT BETWEEN 2 AND 24 OR p_interval NOT BETWEEN 7 AND 90
 OR p_first < current_date OR p_first > current_date+366
 OR length(coalesce(p_note,''))>600 THEN RAISE EXCEPTION 'Invalid payment schedule'; END IF;
 SELECT total,status INTO v_total,v_status FROM public.orders WHERE business_id=p_business AND id=p_order FOR UPDATE;
 IF NOT FOUND OR v_status='cancelled' THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE business_id=p_business AND order_id=p_order AND status='completed';
 IF greatest(0,coalesce(v_total,0)-v_paid)<=0 THEN RAISE EXCEPTION 'No outstanding balance'; END IF;
 INSERT INTO public.business_order_installment_plans(business_id,order_id,installment_count,first_due_on,frequency_days,note,recorded_by)
 VALUES(p_business,p_order,p_count,p_first,p_interval,coalesce(p_note,''),auth.uid())
 ON CONFLICT(business_id,order_id) DO UPDATE SET installment_count=excluded.installment_count,first_due_on=excluded.first_due_on,
  frequency_days=excluded.frequency_days,note=excluded.note,active=true,recorded_by=excluded.recorded_by,updated_at=now()
 RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_set_wholesale_price_tier(p_business uuid, p_product uuid, p_min_qty numeric, p_price numeric, p_note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_product public.products%rowtype;v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_can_perform_action(p_business,'purchasing','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
   SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager')) THEN
   RAISE EXCEPTION 'Only POS owners and managers can set wholesale tiers' USING ERRCODE='42501'; END IF;
 IF p_min_qty IS NULL OR p_min_qty<2 OR p_min_qty>1000000 OR round(p_min_qty,3)<>p_min_qty OR
   p_price IS NULL OR p_price<=0 OR p_price>9999999999 OR round(p_price,2)<>p_price OR
   length(coalesce(p_note,''))>250 THEN RAISE EXCEPTION 'Invalid wholesale pricing'; END IF;
 SELECT * INTO v_product FROM public.products WHERE business_id=p_business AND id=p_product AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not available in this business'; END IF;
 IF p_price>v_product.selling_price THEN RAISE EXCEPTION 'Wholesale price cannot exceed current regular selling price'; END IF;
 INSERT INTO public.business_wholesale_price_tiers(business_id,product_id,min_quantity,unit_price,note,updated_by)
 VALUES(p_business,p_product,p_min_qty,p_price,btrim(coalesce(p_note,'')),auth.uid())
 ON CONFLICT(business_id,product_id,min_quantity)
 DO UPDATE SET unit_price=excluded.unit_price,note=excluded.note,updated_by=auth.uid(),updated_at=now()
 RETURNING id INTO v_id;
 RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.business_transfer_location_stock(p_business uuid, p_request uuid, p_product uuid, p_from uuid, p_to uuid, p_quantity numeric, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_existing public.business_location_stock_transfers%rowtype;v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'inventory') OR NOT public.business_can_perform_action(p_business,'inventory','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'inventory') OR NOT EXISTS
  (SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager')) THEN RAISE EXCEPTION 'Owner/manager inventory access required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_product IS NULL OR p_from IS NULL OR p_to IS NULL OR p_from=p_to
 OR p_quantity IS NULL OR p_quantity<=0 OR p_quantity>1000000 OR round(p_quantity,3)<>p_quantity
 OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Invalid stock transfer'; END IF;
 PERFORM 1 FROM public.products WHERE id=p_product AND business_id=p_business AND active AND track_inventory FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tracked product unavailable'; END IF;
 SELECT * INTO v_existing FROM public.business_location_stock_transfers
 WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF v_existing.product_id<>p_product OR v_existing.from_location_id<>p_from OR v_existing.to_location_id<>p_to
   OR v_existing.quantity<>p_quantity OR v_existing.reason<>btrim(p_reason) THEN RAISE EXCEPTION 'Transfer key reused for different details'; END IF;
  RETURN v_existing.id;
 END IF;
 IF (SELECT count(*) FROM public.business_stock_locations WHERE business_id=p_business AND active AND id IN (p_from,p_to))<>2 THEN
  RAISE EXCEPTION 'Transfer locations must belong to this business and be active'; END IF;
 UPDATE public.business_location_balances SET quantity=quantity-p_quantity,updated_at=now()
 WHERE business_id=p_business AND product_id=p_product AND location_id=p_from AND quantity>=p_quantity;
 IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock at source location'; END IF;
 INSERT INTO public.business_location_balances(business_id,location_id,product_id,quantity)
 VALUES(p_business,p_to,p_product,0) ON CONFLICT DO NOTHING;
 UPDATE public.business_location_balances SET quantity=quantity+p_quantity,updated_at=now()
 WHERE business_id=p_business AND product_id=p_product AND location_id=p_to
 AND quantity+p_quantity<=99999999999;
 IF NOT FOUND THEN RAISE EXCEPTION 'Destination location balance limit exceeded'; END IF;
 INSERT INTO public.business_location_stock_transfers(business_id,request_id,product_id,from_location_id,to_location_id,quantity,reason,transferred_by)
 VALUES(p_business,p_request,p_product,p_from,p_to,p_quantity,btrim(p_reason),auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.catalog_create_item(p_business uuid, p_name text, p_type text, p_sku text, p_description text, p_price numeric, p_cost numeric, p_track boolean, p_initial_stock numeric, p_minimum numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_role text;
BEGIN
 IF (NOT public.business_plan_core_feature_allowed(p_business,'products') OR NOT public.business_can_perform_action(p_business,'products','create')) OR ((p_track OR p_initial_stock>0) AND (NOT public.business_has_feature(p_business,'inventory') OR NOT public.business_can_perform_action(p_business,'inventory','create'))) THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 select role::text into v_role from public.business_members where business_id=p_business and user_id=auth.uid() limit 1;
 if v_role is null or v_role not in ('owner','manager','inventory') then raise exception 'Not authorised'; end if;
 if trim(coalesce(p_name,''))='' or length(p_name)>160 or p_type not in ('product','service','package') or p_price is null or p_price<0 or p_cost is null or p_cost<0 or p_initial_stock is null or p_initial_stock<0 or p_minimum is null or p_minimum<0 then raise exception 'Invalid item'; end if;
 if p_type='service' and (p_track or p_initial_stock<>0) then raise exception 'Services cannot track stock'; end if;
 if not p_track and p_initial_stock<>0 then raise exception 'Stock cannot be supplied when tracking is off'; end if;
 insert into public.products(business_id,name,sku,description,selling_price,cost_price,stock_quantity,minimum_stock,item_type,track_inventory)
 values(p_business,trim(p_name),nullif(trim(coalesce(p_sku,'')),''),nullif(trim(coalesce(p_description,'')),''),p_price,p_cost,p_initial_stock,p_minimum,p_type,p_track) returning id into v_id;
 if p_track and p_initial_stock>0 then
  insert into public.inventory_movements(business_id,product_id,movement_type,quantity,notes) values(p_business,v_id,'adjustment',p_initial_stock,'Opening stock');
 end if;
 return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.gl_add_account(p_business uuid, p_code text, p_name text, p_class text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;v_normal text;
BEGIN
 IF NOT public.business_has_feature(p_business,'accounting') OR NOT public.business_can_perform_action(p_business,'accounting','create') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 if not public.gl_can_manage(p_business) then raise exception 'Not permitted';end if;
 if p_class not in ('asset','liability','equity','income','expense') then raise exception 'Invalid account class';end if;
 v_normal:=case when p_class in ('asset','expense') then 'debit' else 'credit' end;
 insert into public.gl_accounts(business_id,code,name,class,normal_side) values(p_business,trim(p_code),trim(p_name),p_class,v_normal) returning id into v_id;
 return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.gl_configure_integration(p_business uuid, p_enabled boolean, p_cash uuid, p_receivable uuid, p_advance uuid, p_income uuid, p_delivery uuid, p_tax uuid, p_expense uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_old public.gl_integration_settings%ROWTYPE;
BEGIN
 IF NOT public.business_has_feature(p_business,'accounting') OR NOT public.business_can_perform_action(p_business,'accounting','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'accounting')
 THEN RAISE EXCEPTION 'Accounting permission or subscription required' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'An enabled setting is required'; END IF;
 IF EXISTS(SELECT 1 FROM public.gl_journals WHERE business_id=p_business AND source_type IN ('invoice','payment','expense')) THEN
  SELECT * INTO v_old FROM public.gl_integration_settings WHERE business_id=p_business FOR UPDATE;
  IF NOT FOUND OR ROW(v_old.cash_account_id,v_old.receivable_account_id,v_old.advance_account_id,v_old.income_account_id,v_old.delivery_account_id,v_old.tax_account_id,v_old.expense_account_id)
    IS DISTINCT FROM ROW(p_cash,p_receivable,p_advance,p_income,p_delivery,p_tax,p_expense)
  THEN RAISE EXCEPTION 'Account mappings cannot change after source journals exist. Contact an accountant for controlled adjustments.'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_cash AND class='asset' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_receivable AND class='asset' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_advance AND class='liability' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_income AND class='income' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_delivery AND class='income' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_tax AND class='liability' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_expense AND class='expense' AND active)
 THEN RAISE EXCEPTION 'Every mapping must point to an active account of the correct class in this business'; END IF;
 IF p_cash=p_receivable OR p_cash=p_advance OR p_receivable=p_advance THEN
  RAISE EXCEPTION 'Cash, receivables and customer advances must use different accounts'; END IF;
 INSERT INTO public.gl_integration_settings (business_id,enabled,cash_account_id,receivable_account_id,advance_account_id,income_account_id,delivery_account_id,tax_account_id,expense_account_id,updated_by)
 VALUES(p_business,p_enabled,p_cash,p_receivable,p_advance,p_income,p_delivery,p_tax,p_expense,auth.uid())
 ON CONFLICT(business_id) DO UPDATE SET enabled=EXCLUDED.enabled,cash_account_id=EXCLUDED.cash_account_id,
 receivable_account_id=EXCLUDED.receivable_account_id,advance_account_id=EXCLUDED.advance_account_id,
 income_account_id=EXCLUDED.income_account_id,delivery_account_id=EXCLUDED.delivery_account_id,
 tax_account_id=EXCLUDED.tax_account_id,expense_account_id=EXCLUDED.expense_account_id,
 updated_by=EXCLUDED.updated_by,updated_at=now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gl_create_period(p_business uuid, p_name text, p_start date, p_end date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'accounting') OR NOT public.business_can_perform_action(p_business,'accounting','create') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 if not public.gl_can_manage(p_business) then raise exception 'Not permitted';end if;
 if p_start is null or p_end is null or p_start>p_end then raise exception 'Invalid period';end if;
 insert into public.gl_periods(business_id,name,starts_on,ends_on) values(p_business,trim(p_name),p_start,p_end) returning id into v_id;
 return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.gl_discover_existing_sources(p_business uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_i integer;v_p integer;v_e integer;
BEGIN
 IF NOT public.business_has_feature(p_business,'accounting') OR NOT public.business_can_perform_action(p_business,'accounting','create') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'accounting') THEN
   RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.gl_source_events(business_id,source_type,source_id,occurred_at)
 SELECT business_id,'invoice',id,issued_at FROM public.business_invoices WHERE business_id=p_business
 ON CONFLICT(business_id,source_type,source_id) DO NOTHING;
 GET DIAGNOSTICS v_i=ROW_COUNT;
 INSERT INTO public.gl_source_events(business_id,source_type,source_id,occurred_at)
 SELECT business_id,'payment',id,paid_at FROM public.payments WHERE business_id=p_business AND status='completed'
 ON CONFLICT(business_id,source_type,source_id) DO NOTHING;
 GET DIAGNOSTICS v_p=ROW_COUNT;
 INSERT INTO public.gl_source_events(business_id,source_type,source_id,occurred_at)
 SELECT business_id,'expense',id,paid_at FROM public.expenses WHERE business_id=p_business
 ON CONFLICT(business_id,source_type,source_id) DO NOTHING;
 GET DIAGNOSTICS v_e=ROW_COUNT;
 RETURN jsonb_build_object('invoices',v_i,'payments',v_p,'expenses',v_e);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gl_post_journal(p_business uuid, p_date date, p_description text, p_reference text, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_period uuid;v_journal uuid;v_entry jsonb;v_account uuid;v_debit numeric(18,2);v_credit numeric(18,2);v_td numeric(18,2):=0;v_tc numeric(18,2):=0;v_i integer:=0;
BEGIN
 IF NOT public.business_has_feature(p_business,'accounting') OR NOT public.business_can_perform_action(p_business,'accounting','create') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
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
end $function$
;

CREATE OR REPLACE FUNCTION public.gl_process_accounting_queue(p_business uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;v_done integer:=0;v_failed integer:=0;
BEGIN
 IF NOT public.business_has_feature(p_business,'accounting') OR NOT public.business_can_perform_action(p_business,'accounting','approve') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'accounting') THEN
   RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gl_integration_settings WHERE business_id=p_business AND enabled) THEN
   RAISE EXCEPTION 'Configure and enable accounting integration first'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Limit must be between 1 and 50'; END IF;
 FOR v_id IN SELECT id FROM public.gl_source_events WHERE business_id=p_business AND status IN ('pending','error')
 ORDER BY occurred_at,case source_type WHEN 'payment' THEN 0 WHEN 'invoice' THEN 1 ELSE 2 END,id
 LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  BEGIN
   PERFORM public.gl_post_source_event(v_id);
   v_done:=v_done+1;
  EXCEPTION WHEN OTHERS THEN
   UPDATE public.gl_source_events SET status='error',attempts=attempts+1,
     last_error=left(SQLERRM,450) WHERE id=v_id;
   v_failed:=v_failed+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('posted',v_done,'failed',v_failed);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.inventory_adjust_stock(p_business uuid, p_item uuid, p_delta numeric, p_reason text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_role text; v_stock numeric; v_track boolean;
BEGIN
 IF NOT public.business_has_feature(p_business,'inventory') OR NOT public.business_can_perform_action(p_business,'inventory','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 SELECT role::text INTO v_role FROM public.business_members
 WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL OR v_role NOT IN ('owner','manager','inventory')
 OR NOT public.business_has_feature(p_business,'inventory') THEN
  RAISE EXCEPTION 'Inventory permission required' USING ERRCODE='42501'; END IF;
 IF p_delta IS NULL OR p_delta=0 OR abs(p_delta)>100000000
 OR round(p_delta,3)<>p_delta
 OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN
  RAISE EXCEPTION 'Invalid quantity or reason'; END IF;
 SELECT stock_quantity,track_inventory INTO v_stock,v_track
 FROM public.products WHERE id=p_item AND business_id=p_business AND active FOR UPDATE;
 IF NOT FOUND OR NOT v_track THEN RAISE EXCEPTION 'Active tracked product not found'; END IF;
 IF v_stock+p_delta<0 OR v_stock+p_delta>99999999999 THEN
  RAISE EXCEPTION 'Resulting stock is out of range'; END IF;
 UPDATE public.products SET stock_quantity=v_stock+p_delta,updated_at=now()
 WHERE id=p_item AND business_id=p_business;
 INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,notes)
 VALUES(p_business,p_item,'adjustment',p_delta,btrim(p_reason));
 RETURN v_stock+p_delta;
END;$function$
;

CREATE OR REPLACE FUNCTION public.inventory_record_stock_count(p_business uuid, p_item uuid, p_expected numeric, p_counted numeric, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_role text; v_actual numeric; v_track boolean; v_delta numeric;
        v_id uuid; v_movement uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'inventory') OR NOT public.business_can_perform_action(p_business,'inventory','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 SELECT role::text INTO v_role FROM public.business_members
 WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL OR v_role NOT IN ('owner','manager','inventory')
 OR NOT public.business_has_feature(p_business,'inventory') THEN
  RAISE EXCEPTION 'Inventory permission required' USING ERRCODE='42501'; END IF;
 IF p_expected IS NULL OR p_counted IS NULL OR p_expected<0 OR p_counted<0
 OR p_counted>99999999999 OR p_expected>99999999999
 OR round(p_expected,3)<>p_expected OR round(p_counted,3)<>p_counted
 OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Invalid stock count'; END IF;
 SELECT stock_quantity,track_inventory INTO v_actual,v_track
 FROM public.products WHERE id=p_item AND business_id=p_business AND active FOR UPDATE;
 IF NOT FOUND OR NOT v_track THEN RAISE EXCEPTION 'Active tracked product not found'; END IF;
 IF v_actual IS DISTINCT FROM p_expected THEN
  RAISE EXCEPTION 'Stock changed since page loaded. Reload inventory and recount before saving.' USING ERRCODE='40001';
 END IF;
 v_delta:=p_counted-v_actual;
 IF v_delta<>0 THEN
  UPDATE public.products SET stock_quantity=p_counted,updated_at=now()
  WHERE business_id=p_business AND id=p_item;
  INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,notes)
  VALUES(p_business,p_item,'adjustment',v_delta,'Stock count: '||btrim(p_reason))
  RETURNING id INTO v_movement;
 END IF;
 INSERT INTO public.inventory_stock_counts(
  business_id,product_id,expected_quantity,counted_quantity,reason,counted_by,movement_id)
 VALUES(p_business,p_item,p_expected,p_counted,btrim(p_reason),auth.uid(),v_movement)
 RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;
COMMIT;