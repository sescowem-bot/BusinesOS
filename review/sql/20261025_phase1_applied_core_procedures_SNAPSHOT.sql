-- APPLIED PRODUCTION SNAPSHOT. DO NOT EXECUTE AGAIN.
-- The three original migrations ran on 25 October 2026.
-- Their canonical migration versions are stored in Supabase migration history.
-- This file reproduces the verified current procedure definitions for code review.
CREATE OR REPLACE FUNCTION public.crm_create_customer(p_business uuid, p_name text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_membership_is_active(p_business,auth.uid())
 OR NOT EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=p_business AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales'))
 OR NOT public.business_plan_core_feature_allowed(p_business,'customers')
 OR NOT public.business_can_perform_action(p_business,'customers','create')
 THEN RAISE EXCEPTION 'Customer creation not permitted for this business plan or staff role' USING ERRCODE='42501'; END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 150 OR length(coalesce(p_phone,''))>40 OR length(coalesce(p_email,''))>254
 THEN RAISE EXCEPTION 'Invalid customer details'; END IF;
 INSERT INTO public.customers(name,phone,email) VALUES(trim(p_name),nullif(trim(p_phone),''),nullif(trim(p_email),'')) RETURNING id INTO v_id;
 INSERT INTO public.business_customers(business_id,customer_id) VALUES(p_business,v_id);
 RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.crm_record_payment(p_business uuid, p_order uuid, p_amount numeric, p_method payment_method, p_reference text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_customer uuid; v_total numeric; v_paid numeric; v_payment uuid;
BEGIN
 IF auth.uid() IS NULL
   OR NOT public.business_membership_is_active(p_business,auth.uid())
   OR NOT EXISTS (SELECT 1 FROM public.business_members
      WHERE business_id=p_business AND user_id=auth.uid()
        AND role IN ('owner','manager','finance','sales'))
   OR NOT public.business_plan_core_feature_allowed(p_business,'payments')
   OR NOT public.business_can_perform_action(p_business,'payments','create')
 THEN RAISE EXCEPTION 'Payment entry permission denied' USING ERRCODE='42501'; END IF;
 SELECT customer_id,total INTO v_customer,v_total FROM public.orders
  WHERE id=p_order AND business_id=p_business AND status<>'cancelled' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>999999999 OR length(coalesce(p_reference,''))>150
 THEN RAISE EXCEPTION 'Invalid payment'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments
  WHERE order_id=p_order AND status='completed';
 IF p_amount>v_total-v_paid THEN RAISE EXCEPTION 'Payment exceeds outstanding balance'; END IF;
 INSERT INTO public.payments(business_id,order_id,customer_id,amount,method,status,reference)
 VALUES(p_business,p_order,v_customer,p_amount,p_method,'completed',nullif(trim(p_reference),''))
 RETURNING id INTO v_payment;
 RETURN v_payment;
END $function$;

CREATE OR REPLACE FUNCTION public.gl_record_paid_expense(p_business uuid, p_description text, p_amount numeric, p_paid_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'expenses')
 OR NOT public.business_plan_core_feature_allowed(p_business,'expenses')
 OR NOT public.business_can_perform_action(p_business,'expenses','create')
 THEN RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501'; END IF;
 IF length(trim(coalesce(p_description,''))) NOT BETWEEN 3 AND 300 OR p_amount IS NULL
 OR p_amount<=0 OR p_amount>999999999 OR round(p_amount,2)<>p_amount OR p_paid_at IS NULL
 OR p_paid_at>now()+interval '1 day' THEN RAISE EXCEPTION 'Invalid expense details'; END IF;
 INSERT INTO public.expenses(business_id,description,amount,paid_at)
 VALUES(p_business,trim(p_description),p_amount,p_paid_at) RETURNING id INTO v_id;
 RETURN v_id;
END $function$;