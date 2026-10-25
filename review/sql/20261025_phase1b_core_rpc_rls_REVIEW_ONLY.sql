-- SUPERSEDED REVIEW PROPOSAL: NEVER EXECUTE THIS FILE.
-- The 20261025 Phase 1/1D migrations supersede these proposed definitions and policies.
-- Use review/PHASE1_RELEASE_LEDGER_20261025.md and the already-applied migration history instead.
-- BusinessOS Phase 1B: targeted core RPC and direct-table write hardening.
-- REVIEW ONLY: NOT APPLIED. Require operator verification and recoverable backup first.
-- Atomic migration; does not update business records or turn on the global switches.
-- Follow-up must review every remaining RPC before enabling global action overrides.
BEGIN;
SET LOCAL statement_timeout = '20000ms';
DO $preflight$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.platform_plan_action_enforcement WHERE id=true AND enabled=false)
 THEN RAISE EXCEPTION 'Action enforcement must stay disabled for Phase 1B' USING ERRCODE='P0001'; END IF;
 IF to_regprocedure('public.business_can_perform_action(uuid,text,text)') IS NULL
    OR to_regprocedure('public.business_plan_core_feature_allowed(uuid,text)') IS NULL
 THEN RAISE EXCEPTION 'Required authorization functions not present' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.business_customers'::regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.expenses'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Expected tenant tables must retain RLS' USING ERRCODE='P0001'; END IF;
END $preflight$;

-- A SECURITY DEFINER function bypasses row RLS: guard it *inside* the procedure.
CREATE OR REPLACE FUNCTION public.crm_create_customer(
 p_business uuid,p_name text,p_phone text DEFAULT NULL::text,p_email text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $func$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL
    OR NOT public.business_membership_is_active(p_business,auth.uid())
    OR NOT EXISTS(SELECT 1 FROM public.business_members m
        WHERE m.business_id=p_business AND m.user_id=auth.uid()
          AND m.role IN ('owner','manager','finance','sales'))
    OR NOT public.business_plan_core_feature_allowed(p_business,'customers')
    OR NOT public.business_can_perform_action(p_business,'customers','create')
 THEN RAISE EXCEPTION 'Customer creation not permitted for this plan or staff role'
   USING ERRCODE='42501'; END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 150
    OR length(coalesce(p_phone,''))>40 OR length(coalesce(p_email,''))>254
 THEN RAISE EXCEPTION 'Invalid customer details' USING ERRCODE='22023'; END IF;
 INSERT INTO public.customers(name,phone,email)
 VALUES(trim(p_name),nullif(trim(p_phone),''),nullif(trim(p_email),''))
 RETURNING id INTO v_id;
 INSERT INTO public.business_customers(business_id,customer_id) VALUES(p_business,v_id);
 RETURN v_id;
END $func$;

CREATE OR REPLACE FUNCTION public.crm_record_payment(
 p_business uuid,p_order uuid,p_amount numeric,p_method public.payment_method,
 p_reference text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $func$
DECLARE v_customer uuid; v_total numeric; v_paid numeric; v_payment uuid;
BEGIN
 IF auth.uid() IS NULL
    OR NOT public.business_membership_is_active(p_business,auth.uid())
    OR NOT EXISTS(SELECT 1 FROM public.business_members m
       WHERE m.business_id=p_business AND m.user_id=auth.uid()
         AND m.role IN ('owner','manager','finance','sales'))
    OR NOT public.business_plan_core_feature_allowed(p_business,'payments')
    OR NOT public.business_can_perform_action(p_business,'payments','create')
 THEN RAISE EXCEPTION 'Payment recording not permitted for this plan or staff role'
   USING ERRCODE='42501'; END IF;
 SELECT customer_id,total INTO v_customer,v_total
 FROM public.orders WHERE id=p_order AND business_id=p_business AND status<>'cancelled' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='P0001'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>999999999 OR length(coalesce(p_reference,''))>150
 THEN RAISE EXCEPTION 'Invalid payment' USING ERRCODE='22023'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments
 WHERE order_id=p_order AND status='completed';
 IF p_amount>v_total-v_paid THEN
  RAISE EXCEPTION 'Payment exceeds outstanding balance' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.payments(business_id,order_id,customer_id,amount,method,status,reference)
 VALUES(p_business,p_order,v_customer,p_amount,p_method,'completed',nullif(trim(p_reference),'')) RETURNING id INTO v_payment;
 RETURN v_payment;
END $func$;

-- Finance RPC keeps its current calculation and validation, adding the plan/action gate.
CREATE OR REPLACE FUNCTION public.gl_record_paid_expense(
 p_business uuid,p_description text,p_amount numeric,p_paid_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $func$
DECLARE v_id uuid;
BEGIN
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'expenses')
    OR NOT public.business_plan_core_feature_allowed(p_business,'expenses')
    OR NOT public.business_can_perform_action(p_business,'expenses','create')
 THEN RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501'; END IF;
 IF length(trim(coalesce(p_description,''))) NOT BETWEEN 3 AND 300
    OR p_amount IS NULL OR p_amount<=0 OR p_amount>999999999
    OR round(p_amount,2)<>p_amount OR p_paid_at IS NULL OR p_paid_at>now()+interval '1 day'
 THEN RAISE EXCEPTION 'Invalid expense details' USING ERRCODE='22023'; END IF;
 INSERT INTO public.expenses(business_id,description,amount,paid_at)
 VALUES(p_business,trim(p_description),p_amount,p_paid_at) RETURNING id INTO v_id;
 RETURN v_id;
END $func$;

-- Revoke dangerous ACLs not mediated by RLS. SELECT and ordinary DML grants stay unchanged.
REVOKE TRUNCATE,TRIGGER,REFERENCES ON TABLE
 public.business_customers,public.customers,public.orders,public.order_items,
 public.payments,public.expenses FROM PUBLIC,anon,authenticated;

-- Restricted RLS rules stop members making arbitrary direct REST table writes.
-- Existing permissive tenant policies still apply in addition to these guards.
DROP POLICY IF EXISTS businessos_core_customer_link_insert ON public.business_customers;
CREATE POLICY businessos_core_customer_link_insert ON public.business_customers
 AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.business_plan_core_feature_allowed(business_id,'customers')
  AND public.business_can_perform_action(business_id,'customers','create')
  AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_customers.business_id
   AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager','finance','sales'))
  AND EXISTS(SELECT 1 FROM public.customers c WHERE c.id=customer_id AND c.user_id=(SELECT auth.uid()))
 );
DROP POLICY IF EXISTS businessos_core_customer_link_update ON public.business_customers;
CREATE POLICY businessos_core_customer_link_update ON public.business_customers
 AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (
  public.business_plan_core_feature_allowed(business_id,'customers')
  AND public.business_can_perform_action(business_id,'customers','edit')
  AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_customers.business_id
   AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager','finance','sales'))
 ) WITH CHECK (
  public.business_plan_core_feature_allowed(business_id,'customers')
  AND public.business_can_perform_action(business_id,'customers','edit')
  AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_customers.business_id
   AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager','finance','sales'))
  AND EXISTS(SELECT 1 FROM public.customers c WHERE c.id=customer_id AND c.user_id=(SELECT auth.uid()))
 );
DROP POLICY IF EXISTS businessos_core_customer_link_delete ON public.business_customers;
CREATE POLICY businessos_core_customer_link_delete ON public.business_customers
 AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.business_plan_core_feature_allowed(business_id,'customers')
  AND public.business_can_perform_action(business_id,'customers','delete')
  AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_customers.business_id
   AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager','finance','sales'))
 );

DROP POLICY IF EXISTS businessos_core_expense_insert ON public.expenses;
CREATE POLICY businessos_core_expense_insert ON public.expenses
 AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.business_plan_core_feature_allowed(business_id,'expenses')
  AND public.business_can_perform_action(business_id,'expenses','create')
  AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=expenses.business_id
   AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager','finance'))
 );
DROP POLICY IF EXISTS businessos_core_expense_update ON public.expenses;
CREATE POLICY businessos_core_expense_update ON public.expenses
 AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (
  public.business_plan_core_feature_allowed(business_id,'expenses')
  AND public.business_can_perform_action(business_id,'expenses','edit')
  AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=expenses.business_id
   AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager','finance'))
 ) WITH CHECK (
  public.business_plan_core_feature_allowed(business_id,'expenses')
  AND public.business_can_perform_action(business_id,'expenses','edit')
  AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=expenses.business_id
   AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager','finance'))
 );
DROP POLICY IF EXISTS businessos_core_expense_delete ON public.expenses;
CREATE POLICY businessos_core_expense_delete ON public.expenses
 AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.business_plan_core_feature_allowed(business_id,'expenses')
  AND public.business_can_perform_action(business_id,'expenses','delete')
  AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=expenses.business_id
   AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager','finance'))
 );

-- Never enable global action overrides or numerical caps in this migration.
COMMIT;