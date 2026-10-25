-- BusinessOS Phase 1D — Preserve original function bodies and add entry authorization.
BEGIN;
CREATE OR REPLACE FUNCTION public.crm_create_order(p_business uuid, p_customer uuid, p_description text, p_quantity numeric, p_unit_price numeric, p_discount numeric DEFAULT 0, p_delivery numeric DEFAULT 0, p_due_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order uuid; v_number text; v_subtotal numeric(14,2);
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'orders') OR NOT public.business_can_perform_action(p_business,'orders','create') THEN RAISE EXCEPTION 'Order create denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members
   WHERE business_id=p_business AND user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.business_tax_profiles
   WHERE business_id=p_business AND vat_registration_status='registered' AND classification_status='reviewed') THEN
  RAISE EXCEPTION 'Use a reviewed VAT order; legacy untaxed orders are disabled for this business.' USING ERRCODE='P0001'; END IF;
 IF p_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_customers
   WHERE business_id=p_business AND customer_id=p_customer) THEN
  RAISE EXCEPTION 'Customer does not belong to business' USING ERRCODE='P0001'; END IF;
 IF length(trim(coalesce(p_description,''))) NOT BETWEEN 2 AND 200 OR p_quantity IS NULL
  OR p_quantity<=0 OR p_quantity>999999 OR p_unit_price IS NULL OR p_unit_price<0
  OR p_unit_price>999999999 OR coalesce(p_discount,-1)<0 OR coalesce(p_delivery,-1)<0 THEN
  RAISE EXCEPTION 'Invalid order fields' USING ERRCODE='P0001'; END IF;
 v_subtotal:=round(p_quantity*p_unit_price,2);
 IF p_discount>v_subtotal THEN RAISE EXCEPTION 'Discount exceeds subtotal' USING ERRCODE='P0001'; END IF;
 v_number:='ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 INSERT INTO public.orders(business_id,customer_id,order_number,status,subtotal,discount,delivery_fee,tax,due_date)
 VALUES(p_business,p_customer,v_number,'new',v_subtotal,p_discount,p_delivery,0,p_due_date)
 RETURNING id INTO v_order;
 INSERT INTO public.order_items(order_id,name_snapshot,quantity,unit_price,unit_cost)
 VALUES(v_order,trim(p_description),p_quantity,p_unit_price,0);
 RETURN v_order;
END $function$;

CREATE OR REPLACE FUNCTION public.crm_create_order_with_cost(p_business uuid, p_customer uuid, p_request_key uuid, p_mode text, p_description text, p_supply uuid, p_quantity numeric, p_unit_price numeric, p_discount numeric, p_delivery numeric, p_due_date date, p_payment_state text, p_payment_amount numeric, p_payment_method text, p_payment_reference text, p_unit_cost numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_role text;v_existing uuid;v_order uuid;v_old_cost numeric;v_line_id uuid;v_items int;
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'orders') OR NOT public.business_can_perform_action(p_business,'orders','create') THEN RAISE EXCEPTION 'Order create denied' USING ERRCODE='42501'; END IF;
 
 SELECT role::text INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR v_role NOT IN ('owner','manager','finance','sales') THEN RAISE EXCEPTION 'Sales permission required' USING ERRCODE='42501'; END IF;
 IF p_unit_cost IS NOT NULL AND (v_role NOT IN ('owner','manager','finance') OR
 p_unit_cost<0 OR p_unit_cost>9999999999.99 OR round(p_unit_cost,2)<>p_unit_cost) THEN
  RAISE EXCEPTION 'Only authorised owners/managers/finance may record valid item costs' USING ERRCODE='42501'; END IF;
 -- Existing request key cannot be replayed later with new cost evidence.
 SELECT order_id INTO v_existing FROM public.business_order_create_requests
 WHERE business_id=p_business AND request_key=p_request_key FOR UPDATE;
 IF FOUND AND p_unit_cost IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_order_cost_evidence
  WHERE order_id=v_existing AND business_id=p_business AND unit_cost=p_unit_cost) THEN
  RAISE EXCEPTION 'Order request already exists with different or unrecorded item cost'; END IF;
 IF FOUND AND p_unit_cost IS NULL AND EXISTS(SELECT 1 FROM public.business_order_cost_evidence WHERE order_id=v_existing) THEN
  RAISE EXCEPTION 'Order request already exists with recorded item cost'; END IF;
 v_order:=public.crm_create_order_with_initial_payment(p_business,p_customer,p_request_key,p_mode,
  p_description,p_supply,p_quantity,p_unit_price,p_discount,p_delivery,p_due_date,
  p_payment_state,p_payment_amount,p_payment_method,p_payment_reference);
 IF p_unit_cost IS NOT NULL AND v_existing IS NULL THEN
  SELECT count(*),min(id::text)::uuid INTO v_items,v_line_id FROM public.order_items WHERE order_id=v_order;
  IF v_items<>1 THEN RAISE EXCEPTION 'Cannot record manual cost for a multi-item order'; END IF;
  UPDATE public.order_items SET unit_cost=p_unit_cost WHERE id=v_line_id AND order_id=v_order;
  INSERT INTO public.business_order_cost_evidence(order_id,business_id,unit_cost,recorded_by)
  VALUES(v_order,p_business,p_unit_cost,auth.uid());
 END IF;
 RETURN v_order;
END $function$;

CREATE OR REPLACE FUNCTION public.crm_create_order_with_initial_payment(p_business uuid, p_customer uuid, p_request_key uuid, p_mode text, p_description text DEFAULT NULL::text, p_supply uuid DEFAULT NULL::uuid, p_quantity numeric DEFAULT NULL::numeric, p_unit_price numeric DEFAULT NULL::numeric, p_discount numeric DEFAULT 0, p_delivery numeric DEFAULT 0, p_due_date date DEFAULT NULL::date, p_payment_state text DEFAULT 'unpaid'::text, p_payment_amount numeric DEFAULT 0, p_payment_method text DEFAULT NULL::text, p_payment_reference text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_role text;v_order uuid;v_total numeric(14,2);v_paid numeric(14,2):=0;
 v_fingerprint text;v_rows integer;v_existing public.business_order_create_requests%ROWTYPE;
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'orders') OR NOT public.business_can_perform_action(p_business,'orders','create') THEN RAISE EXCEPTION 'Order create denied' USING ERRCODE='42501'; END IF;
 IF p_payment_state='partial' AND (NOT public.business_plan_core_feature_allowed(p_business,'payments') OR NOT public.business_can_perform_action(p_business,'payments','create')) THEN RAISE EXCEPTION 'Initial payment denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 SELECT role::text INTO v_role FROM public.business_members
 WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL OR v_role NOT IN ('owner','manager','finance','sales') THEN
  RAISE EXCEPTION 'Insufficient sales permissions' USING ERRCODE='42501';END IF;
 IF p_request_key IS NULL OR p_request_key='00000000-0000-0000-0000-000000000000'::uuid THEN
  RAISE EXCEPTION 'Missing checkout request identifier' USING ERRCODE='22023';END IF;
 IF p_mode NOT IN ('manual','reviewed') OR p_mode IS NULL
  OR p_customer IS NULL OR p_quantity IS NULL OR p_unit_price IS NULL
  OR p_payment_state IS NULL OR p_payment_state NOT IN ('unpaid','partial','paid')
  OR p_discount IS NULL OR p_delivery IS NULL THEN
  RAISE EXCEPTION 'Invalid order or payment selection' USING ERRCODE='22023';END IF;
 IF length(coalesce(p_payment_reference,''))>150 THEN
  RAISE EXCEPTION 'Payment reference is too long' USING ERRCODE='22023';END IF;
 IF p_mode='reviewed' AND (p_supply IS NULL OR p_delivery<>0) THEN
  RAISE EXCEPTION 'Reviewed tax order requires an approved supply and no delivery fee' USING ERRCODE='22023';END IF;
 IF p_mode='manual' AND p_supply IS NOT NULL THEN
  RAISE EXCEPTION 'Manual order cannot use a reviewed supply' USING ERRCODE='22023';END IF;
 IF p_payment_state='unpaid' AND (p_payment_amount IS NULL OR p_payment_amount<>0) THEN
  RAISE EXCEPTION 'Unpaid orders cannot record a payment' USING ERRCODE='22023';END IF;
 IF p_payment_state='partial' AND (p_payment_amount IS NULL OR p_payment_amount<=0
  OR p_payment_amount<>round(p_payment_amount,2)) THEN
  RAISE EXCEPTION 'Enter a positive partial payment with two decimal places' USING ERRCODE='22023';END IF;
 IF p_payment_state='paid' AND coalesce(p_payment_amount,0)<>0 THEN
  RAISE EXCEPTION 'Full payment is calculated from the saved order total' USING ERRCODE='22023';END IF;
 IF p_payment_state<>'unpaid' AND (p_payment_method IS NULL OR
  p_payment_method NOT IN ('cash','transfer','pos','card','other')) THEN
  RAISE EXCEPTION 'Select a valid recorded payment method' USING ERRCODE='22023';END IF;
 -- Same request key + changed inputs must never silently reuse another order.
 v_fingerprint:=md5((ROW(p_customer,p_mode,p_description,p_supply,p_quantity,p_unit_price,
  p_discount,p_delivery,p_due_date,p_payment_state,p_payment_amount,p_payment_method,p_payment_reference))::text);
 INSERT INTO public.business_order_create_requests(business_id,request_key,created_by,payload_fingerprint)
 VALUES(p_business,p_request_key,auth.uid(),v_fingerprint)
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_rows=ROW_COUNT;
 IF v_rows=0 THEN
  SELECT * INTO v_existing FROM public.business_order_create_requests
  WHERE business_id=p_business AND request_key=p_request_key FOR UPDATE;
  IF v_existing.created_by IS DISTINCT FROM auth.uid() OR
   v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint OR v_existing.order_id IS NULL THEN
   RAISE EXCEPTION 'This order submission was already used. Refresh and retry.' USING ERRCODE='23505';END IF;
  RETURN v_existing.order_id;
 END IF;
 -- Existing, separately protected business sales functions perform ownership and VAT rule checks.
 IF p_mode='reviewed' THEN
  v_order:=public.crm_create_tax_reviewed_order(p_business,p_customer,p_supply,p_quantity,p_unit_price,p_discount,p_due_date);
 ELSE
  v_order:=public.crm_create_order(p_business,p_customer,p_description,p_quantity,p_unit_price,p_discount,p_delivery,p_due_date);
 END IF;
 SELECT total INTO v_total FROM public.orders WHERE id=v_order AND business_id=p_business FOR UPDATE;
 IF v_total IS NULL THEN RAISE EXCEPTION 'Could not verify saved order total';END IF;
 IF p_payment_state='partial' THEN
  IF p_payment_amount>=v_total THEN
   RAISE EXCEPTION 'Partial payment must be less than the order total' USING ERRCODE='22023';END IF;
  v_paid:=p_payment_amount;
 ELSIF p_payment_state='paid' THEN
  IF v_total<=0 THEN RAISE EXCEPTION 'Zero-value orders cannot record a cash payment' USING ERRCODE='22023';END IF;
  v_paid:=v_total;
 END IF;
 IF v_paid>0 THEN
  PERFORM public.crm_record_payment(p_business,v_order,v_paid,p_payment_method::public.payment_method,p_payment_reference);
 END IF;
 UPDATE public.business_order_create_requests SET order_id=v_order
 WHERE business_id=p_business AND request_key=p_request_key;
 RETURN v_order;
END $function$;

CREATE OR REPLACE FUNCTION public.crm_create_tax_reviewed_order(p_business uuid, p_customer uuid, p_supply uuid, p_quantity numeric, p_unit_price numeric, p_discount numeric DEFAULT 0, p_due_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_role text; v_supply public.business_supply_categories%ROWTYPE;
 v_rule_id_text text; v_treatment text; v_rate integer; v_count int; v_currency text; v_order uuid; v_number text;
 v_subtotal numeric(14,2); v_base numeric(14,2); v_vat numeric(14,2);
 v_date date := (now() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'orders') OR NOT public.business_can_perform_action(p_business,'orders','create') THEN RAISE EXCEPTION 'Reviewed order denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT role::text INTO v_role FROM public.business_members
   WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL OR v_role NOT IN ('owner','manager','finance','sales') THEN
  RAISE EXCEPTION 'Insufficient sales permissions' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.business_tax_profiles
   WHERE business_id=p_business AND classification_status='reviewed' AND vat_registration_status='registered') THEN
  RAISE EXCEPTION 'Business VAT profile requires verification' USING ERRCODE='P0001'; END IF;
 SELECT currency INTO v_currency FROM public.businesses WHERE id=p_business;
 IF v_currency IS DISTINCT FROM 'NGN' THEN
  RAISE EXCEPTION 'Reviewed VAT checkout currently supports NGN only' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_customers
   WHERE business_id=p_business AND customer_id=p_customer) THEN
  RAISE EXCEPTION 'Select a customer of this business' USING ERRCODE='P0001'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 OR p_quantity>999999 OR p_unit_price IS NULL
  OR p_unit_price<0 OR p_unit_price>999999999 OR p_discount IS NULL OR p_discount<0 THEN
  RAISE EXCEPTION 'Invalid order amounts' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_supply FROM public.business_supply_categories
   WHERE id=p_supply AND business_id=p_business;
 IF NOT FOUND THEN RAISE EXCEPTION 'Supply category not found' USING ERRCODE='P0001'; END IF;
 -- Fail closed on missing/overlapping rules, changed tax law or unsupported rate.
 SELECT count(*), min(r.id::text),min(r.treatment),min(r.rate_basis_points)
 INTO v_count,v_rule_id_text,v_treatment,v_rate
 FROM public.business_tax_assignments a JOIN public.tax_rule_versions r ON r.id=a.rule_version_id
 WHERE a.business_id=p_business AND a.supply_id=p_supply AND a.status='approved'
   AND r.status='approved' AND r.tax_kind='vat'
   AND r.effective_from<=v_date AND (r.effective_to IS NULL OR r.effective_to>=v_date);
 IF v_count<>1 THEN RAISE EXCEPTION 'Tax classification missing or ambiguous. Review in Tax Centre.' USING ERRCODE='P0001'; END IF;
 IF NOT ((v_treatment='standard' AND v_rate=750)
  OR (v_treatment IN ('zero_rated','exempt','outside_scope') AND v_rate=0)) THEN
  RAISE EXCEPTION 'Tax rate requires professional review' USING ERRCODE='P0001'; END IF;
 v_subtotal:=round(p_quantity*p_unit_price,2);
 IF v_subtotal<=0 OR p_discount>v_subtotal OR v_subtotal>999999999 THEN
  RAISE EXCEPTION 'Invalid taxable amount' USING ERRCODE='P0001'; END IF;
 v_base:=v_subtotal-p_discount;
 v_vat:=round(v_base*v_rate/10000,2);
 v_number:='ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 INSERT INTO public.orders(business_id,customer_id,order_number,status,subtotal,discount,delivery_fee,tax,due_date)
 VALUES(p_business,p_customer,v_number,'new',v_subtotal,p_discount,0,v_vat,p_due_date)
 RETURNING id INTO v_order;
 INSERT INTO public.order_items(order_id,name_snapshot,quantity,unit_price,unit_cost)
 VALUES(v_order,v_supply.name,p_quantity,p_unit_price,0);
 INSERT INTO public.business_order_tax_reviews(order_id,business_id,supply_id,rule_version_id,treatment,
  rate_basis_points,taxable_base,vat_amount,assessed_on,calculated_by)
 VALUES(v_order,p_business,p_supply,v_rule_id_text::uuid,v_treatment,
  v_rate,v_base,v_vat,v_date,auth.uid());
 RETURN v_order;
END $function$;

CREATE OR REPLACE FUNCTION public.issue_business_invoice(p_business uuid, p_order uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role public.member_role;
  v_order public.orders%ROWTYPE;
  v_business public.businesses%ROWTYPE;
  v_customer jsonb;
  v_items jsonb;
  v_paid numeric(14,2);
  v_next bigint;
  v_year integer;
  v_invoice_id uuid;
  v_snapshot jsonb;
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'documents') OR NOT public.business_can_perform_action(p_business,'documents','create') THEN RAISE EXCEPTION 'Invoice issue denied' USING ERRCODE='42501'; END IF;
 
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT role INTO v_role FROM public.business_members
   WHERE business_id=p_business AND user_id=auth.uid();
  IF NOT FOUND OR v_role NOT IN ('owner','manager','finance','sales') THEN
    RAISE EXCEPTION 'Invoice issuance is not allowed for your role' USING ERRCODE='42501';
  END IF;
  -- Locks this specific order so duplicate submissions cannot issue separate invoices.
  SELECT * INTO v_order FROM public.orders
    WHERE id=p_order AND business_id=p_business FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found in your business'; END IF;
  IF v_order.status='cancelled' THEN RAISE EXCEPTION 'Cannot invoice a cancelled order'; END IF;
  IF v_order.total<=0 THEN RAISE EXCEPTION 'Order total must be greater than zero'; END IF;
  SELECT id INTO v_invoice_id FROM public.business_invoices
   WHERE business_id=p_business AND order_id=p_order;
  IF FOUND THEN RETURN v_invoice_id; END IF; -- Repeat requests are idempotent.

  SELECT * INTO v_business FROM public.businesses WHERE id=p_business;
  SELECT jsonb_build_object('name',name,'phone',phone,'email',email,'address',address)
   INTO v_customer FROM public.customers WHERE id=v_order.customer_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('description',name_snapshot,
     'quantity',quantity,'unit_price',unit_price,'line_total',line_total) ORDER BY id),'[]'::jsonb)
   INTO v_items FROM public.order_items WHERE order_id=p_order;
  IF jsonb_array_length(v_items)=0 THEN RAISE EXCEPTION 'No order items to invoice'; END IF;
  SELECT COALESCE(sum(amount),0) INTO v_paid FROM public.payments
   WHERE business_id=p_business AND order_id=p_order AND status='completed';

  v_year := extract(year from (now() AT TIME ZONE 'UTC'))::integer;
  INSERT INTO public.business_invoice_counters(business_id,invoice_year,last_number)
    VALUES(p_business,v_year,1)
    ON CONFLICT(business_id,invoice_year)
    DO UPDATE SET last_number=public.business_invoice_counters.last_number+1
    RETURNING last_number INTO v_next;

  v_snapshot := jsonb_build_object(
    'order_number', v_order.order_number,
    'order_created_at', v_order.created_at,
    'order_due_date', v_order.due_date,
    'seller', jsonb_build_object('name',v_business.name,'address',v_business.address,
               'phone',v_business.phone,'email',v_business.email,'currency',v_business.currency),
    'customer', COALESCE(v_customer,'{}'::jsonb),
    'items',v_items,
    'subtotal',v_order.subtotal,'discount',v_order.discount,
    'delivery_fee',v_order.delivery_fee,'tax_recorded',v_order.tax,
    'total',v_order.total,'paid_at_issue',v_paid
  );
  INSERT INTO public.business_invoices(business_id,order_id,invoice_number,issued_by,snapshot)
   VALUES(p_business,p_order,'INV-'||v_year||'-'||lpad(v_next::text,6,'0'),auth.uid(),v_snapshot)
   RETURNING id INTO v_invoice_id;
  RETURN v_invoice_id;
END;
$function$;

COMMIT;