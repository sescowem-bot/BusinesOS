-- Phase 030I UX follow-up / SQL 036. Apply after 035; test in staging.
-- Atomic order + optional INITIAL payment; the status is derived from completed payments.
-- Do not edit old orders, payments, invoice snapshots or historical tax evidence.
BEGIN;

CREATE TABLE public.business_order_create_requests (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 request_key uuid NOT NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 payload_fingerprint text NOT NULL,
 order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (business_id,request_key)
);
ALTER TABLE public.business_order_create_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_order_create_requests FROM PUBLIC,anon,authenticated;
-- Intentionally no SELECT/INSERT/UPDATE policies: only the controlled RPC may write tokens.

CREATE FUNCTION public.crm_create_order_with_initial_payment(
 p_business uuid,p_customer uuid,p_request_key uuid,p_mode text,
 p_description text DEFAULT NULL,p_supply uuid DEFAULT NULL,
 p_quantity numeric DEFAULT NULL,p_unit_price numeric DEFAULT NULL,
 p_discount numeric DEFAULT 0,p_delivery numeric DEFAULT 0,p_due_date date DEFAULT NULL,
 p_payment_state text DEFAULT 'unpaid',p_payment_amount numeric DEFAULT 0,
 p_payment_method text DEFAULT NULL,p_payment_reference text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_role text;v_order uuid;v_total numeric(14,2);v_paid numeric(14,2):=0;
 v_fingerprint text;v_rows integer;v_existing public.business_order_create_requests%ROWTYPE;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.crm_create_order_with_initial_payment(uuid,uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,date,text,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_create_order_with_initial_payment(uuid,uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,date,text,numeric,text,text) TO authenticated;
COMMENT ON FUNCTION public.crm_create_order_with_initial_payment(uuid,uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,date,text,numeric,text,text)
 IS 'Atomic single-submit customer order and optional verified manually recorded payment. Does not charge a card or send a transfer.';
COMMIT;
