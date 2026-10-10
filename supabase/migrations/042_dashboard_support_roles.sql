-- BusinessOS Phase 030M-C: fast business dashboard, explicit help requests and audited role adjustments.
-- Apply once AFTER SQL 041 in staging. Historical orders, payments, invoices and journals are not changed.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_pos_sales') IS NULL OR
    to_regclass('public.platform_admins') IS NULL OR
    to_regclass('public.business_team_invitations') IS NULL OR
    to_regprocedure('public.business_pos_management_report(uuid,date,date)') IS NULL THEN
   RAISE EXCEPTION 'Install migrations through 041 first';
 END IF;
 IF to_regclass('public.business_support_requests') IS NOT NULL THEN
   RAISE EXCEPTION 'SQL 042 already installed or partially present; inspect before rerunning';
 END IF;
END $$;

-- Reuse existing period/lookup indexes from migrations 001 and 041.
-- Avoid duplicate indexes that would slow down every new order or payment write.

-- Only explicitly captured costs are considered reliable enough for manual-order margins.
-- Historic orders with missing costs remain unevaluated rather than assumed cost-free.
CREATE TABLE public.business_order_cost_evidence (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 unit_cost numeric(14,2) NOT NULL CHECK(unit_cost>=0),
 recorded_by uuid NOT NULL REFERENCES auth.users(id),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_order_cost_evidence_by_company ON public.business_order_cost_evidence(business_id,order_id);
ALTER TABLE public.business_order_cost_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_order_cost_evidence FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_order_cost_evidence TO authenticated;
CREATE POLICY order_cost_evidence_finance_read ON public.business_order_cost_evidence FOR SELECT TO authenticated USING(
 EXISTS (SELECT 1 FROM public.business_members m WHERE m.business_id=business_order_cost_evidence.business_id
 AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance')));

-- Reuse the existing atomic order/payment RPC (036) while saving new cost evidence
-- in THE SAME database transaction. Staff with sales roles cannot enter private costs.
CREATE FUNCTION public.crm_create_order_with_cost(
 p_business uuid,p_customer uuid,p_request_key uuid,p_mode text,p_description text,
 p_supply uuid,p_quantity numeric,p_unit_price numeric,p_discount numeric,p_delivery numeric,p_due_date date,
 p_payment_state text,p_payment_amount numeric,p_payment_method text,p_payment_reference text,p_unit_cost numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text;v_existing uuid;v_order uuid;v_old_cost numeric;v_line_id uuid;v_items int;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.crm_create_order_with_cost(uuid,uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,date,text,numeric,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_create_order_with_cost(uuid,uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,date,text,numeric,text,text,numeric) TO authenticated;

-- Optional one-time evidence for historical manual orders. This does NOT alter order prices,
-- invoice snapshots, payments or tax; it updates the internal cost snapshot only, once.
CREATE FUNCTION public.business_record_missing_order_cost(p_business uuid,p_order uuid,p_unit_cost numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_order public.orders%rowtype;v_items int;v_item_id uuid;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.business_record_missing_order_cost(uuid,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_record_missing_order_cost(uuid,uuid,numeric) TO authenticated;

-- A 7-10 row summary is returned instead of downloading thousands of private records to the browser.
-- Estimated item gross profit comes from POS margin (041) and evidenced manual orders, excluding overhead.
CREATE FUNCTION public.business_dashboard_command(p_business uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text;v_now timestamp;v_from timestamptz;v_to timestamptz;v_prev timestamptz;
 v_order_now numeric:=0;v_order_prev numeric:=0;v_orders bigint:=0;
 v_received numeric:=0;v_received_prev numeric:=0;v_expenses numeric:=0;v_expenses_prev numeric:=0;
 v_outstanding numeric:=0;v_unpaid bigint:=0;v_partial bigint:=0;v_settled bigint:=0;
 v_late bigint:=0;v_stock bigint:=0;v_cost_covered bigint:=0;v_cost_unknown bigint:=0;v_manual_revenue numeric:=0;v_manual_cost numeric:=0;v_recent jsonb:='[]'::jsonb;v_pos jsonb;
BEGIN
 SELECT role::text INTO v_role FROM public.business_members WHERE user_id=auth.uid() AND business_id=p_business;
 IF auth.uid() IS NULL OR v_role IS NULL THEN RAISE EXCEPTION 'Business workspace access denied' USING ERRCODE='42501'; END IF;
 v_now:=now() AT TIME ZONE 'Africa/Lagos';
 v_from:=date_trunc('month',v_now) AT TIME ZONE 'Africa/Lagos';
 v_to:=(date_trunc('month',v_now)+interval '1 month') AT TIME ZONE 'Africa/Lagos';
 v_prev:=(date_trunc('month',v_now)-interval '1 month') AT TIME ZONE 'Africa/Lagos';
 SELECT coalesce(sum(total) FILTER (WHERE created_at>=v_from AND created_at<v_to),0),
        coalesce(sum(total) FILTER (WHERE created_at>=v_prev AND created_at<v_from),0),
        count(*) FILTER (WHERE created_at>=v_from AND created_at<v_to)
 INTO v_order_now,v_order_prev,v_orders FROM public.orders
 WHERE business_id=p_business AND status<>'cancelled' AND created_at>=v_prev AND created_at<v_to;
 SELECT coalesce(sum(amount) FILTER(WHERE paid_at>=v_from AND paid_at<v_to),0),
        coalesce(sum(amount) FILTER(WHERE paid_at>=v_prev AND paid_at<v_from),0)
 INTO v_received,v_received_prev FROM public.payments
 WHERE business_id=p_business AND status='completed' AND paid_at>=v_prev AND paid_at<v_to
 AND EXISTS(SELECT 1 FROM public.orders o WHERE o.id=payments.order_id AND o.business_id=p_business AND o.status<>'cancelled');
 SELECT coalesce(sum(amount) FILTER(WHERE paid_at>=v_from AND paid_at<v_to),0),
        coalesce(sum(amount) FILTER(WHERE paid_at>=v_prev AND paid_at<v_from),0)
 INTO v_expenses,v_expenses_prev FROM public.expenses
 WHERE business_id=p_business AND paid_at>=v_prev AND paid_at<v_to;
 -- Exact outstanding across all valid orders, calculated in the database and not truncated.
 WITH receivables AS (
  SELECT o.id,o.total,o.due_date,coalesce((SELECT sum(p.amount) FROM public.payments p
   WHERE p.business_id=p_business AND p.order_id=o.id AND p.status='completed'),0) AS paid
  FROM public.orders o WHERE o.business_id=p_business AND o.status<>'cancelled'
 )
 SELECT coalesce(sum(greatest(0,total-paid)),0),
 count(*) FILTER(WHERE total>0 AND paid<=0),
 count(*) FILTER(WHERE total>paid AND paid>0),
 count(*) FILTER(WHERE total>0 AND paid>=total),
 count(*) FILTER(WHERE due_date IS NOT NULL AND due_date<(now() AT TIME ZONE 'Africa/Lagos')::date AND total>paid)
 INTO v_outstanding,v_unpaid,v_partial,v_settled,v_late FROM receivables;
 SELECT count(*) INTO v_stock FROM public.products WHERE business_id=p_business AND active AND track_inventory
  AND stock_quantity<=minimum_stock;
 WITH recent AS (
  SELECT o.id,o.order_number,o.created_at,o.status,o.total,
   coalesce((SELECT sum(p.amount) FROM public.payments p WHERE p.business_id=p_business
    AND p.order_id=o.id AND p.status='completed'),0) AS paid
  FROM public.orders o WHERE business_id=p_business ORDER BY created_at DESC,id DESC LIMIT 8
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'number',order_number,'created_at',created_at,
  'status',status,'total',total,'received',paid,'due',greatest(0,total-paid),
  'payment_status',CASE WHEN status='cancelled' THEN 'Cancelled' WHEN total<=0 THEN 'No charge'
   WHEN paid>=total THEN 'Paid' WHEN paid>0 THEN 'Part paid' ELSE 'Unpaid' END)
  ORDER BY created_at DESC,id DESC),'[]'::jsonb) INTO v_recent FROM recent;
 IF v_role IN ('owner','manager','finance') AND public.business_has_feature(p_business,'financial_reports') THEN
  SELECT count(DISTINCT o.id) FILTER(WHERE ev.order_id IS NOT NULL),count(DISTINCT o.id) FILTER(WHERE ev.order_id IS NULL),
    coalesce(sum(o.subtotal-o.discount) FILTER(WHERE ev.order_id IS NOT NULL),0),
    coalesce(sum(coalesce(oi.quantity*oi.unit_cost,0)) FILTER(WHERE ev.order_id IS NOT NULL),0)
  INTO v_cost_covered,v_cost_unknown,v_manual_revenue,v_manual_cost
  FROM public.orders o
  LEFT JOIN public.business_pos_sales ps ON ps.order_id=o.id AND ps.business_id=p_business
  LEFT JOIN public.business_order_cost_evidence ev ON ev.order_id=o.id AND ev.business_id=p_business
  LEFT JOIN public.order_items oi ON oi.order_id=o.id
  WHERE o.business_id=p_business AND o.status<>'cancelled' AND ps.order_id IS NULL
    AND o.created_at>=v_from AND o.created_at<v_to;
  v_pos:=public.business_pos_management_report(p_business,(v_from AT TIME ZONE 'Africa/Lagos')::date,
   ((v_to AT TIME ZONE 'Africa/Lagos')::date-1));
 END IF;
 -- Expenses and profitability are confidential to finance-authorised roles.
 IF v_role NOT IN ('owner','manager','finance') THEN
  v_expenses:=NULL;v_expenses_prev:=NULL;
 END IF;
 -- Generic staff should not receive business financial amounts through the RPC.
 IF v_role='staff' THEN
  v_order_now:=NULL;v_order_prev:=NULL;v_received:=NULL;v_received_prev:=NULL;
  v_outstanding:=NULL;v_recent:='[]'::jsonb;
 END IF;
 RETURN jsonb_build_object('period_start',v_from,'role',v_role,
  'sales',v_order_now,'previous_sales',v_order_prev,'orders',v_orders,
  'received',v_received,'previous_received',v_received_prev,
  'expenses',v_expenses,'previous_expenses',v_expenses_prev,
  'outstanding',v_outstanding,'unpaid_count',v_unpaid,'partial_count',v_partial,
  'paid_count',v_settled,'overdue_count',v_late,'low_stock',v_stock,
  'recent_orders',v_recent,'manual_profit',CASE WHEN v_pos IS NULL THEN NULL
    ELSE jsonb_build_object('revenue_with_cost_evidence',v_manual_revenue,'cost',v_manual_cost,
      'estimated_margin',v_manual_revenue-v_manual_cost,'covered_orders',v_cost_covered,
      'missing_cost_orders',v_cost_unknown) END,
  'pos_profit',CASE WHEN v_pos IS NULL THEN NULL
   ELSE jsonb_build_object('estimated_margin',v_pos #> '{summary,estimated_item_margin_ex_vat}',
    'net_sales',v_pos #> '{summary,net_sales_ex_vat_after_credits}',
    'pos_orders',v_pos #> '{summary,orders}',
    'completed_credits',v_pos #> '{summary,gross_credited}') END);
END $$;
REVOKE ALL ON FUNCTION public.business_dashboard_command(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_dashboard_command(uuid) TO authenticated;

CREATE TABLE public.business_support_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 kind text NOT NULL CHECK(kind IN ('general','role_change')),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 5 AND 140),
 details text NOT NULL CHECK(length(btrim(details)) BETWEEN 10 AND 2000),
 target_user_id uuid REFERENCES auth.users(id),
 proposed_role public.member_role,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','declined')),
 admin_response text CHECK(length(admin_response)<=2000),
 handled_by uuid REFERENCES auth.users(id),
 handled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind='general' AND target_user_id IS NULL AND proposed_role IS NULL)
 OR (kind='role_change' AND target_user_id IS NOT NULL AND proposed_role IS NOT NULL AND proposed_role<>'owner'))
);
CREATE INDEX business_support_by_company ON public.business_support_requests(business_id,created_at DESC);
CREATE INDEX business_support_open_by_date ON public.business_support_requests(created_at DESC) WHERE status='open';
CREATE TABLE public.business_member_role_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES auth.users(id),
 previous_role public.member_role NOT NULL,
 new_role public.member_role NOT NULL,
 changed_by uuid NOT NULL REFERENCES auth.users(id),
 source text NOT NULL CHECK(source IN ('business_owner','platform_support')),
 support_request_id uuid REFERENCES public.business_support_requests(id),
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_member_role_audit_recent ON public.business_member_role_audit(business_id,changed_at DESC);
ALTER TABLE public.business_support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_member_role_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_support_requests,public.business_member_role_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.business_member_role_audit_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_support_requests,public.business_member_role_audit TO authenticated;
CREATE POLICY support_member_read ON public.business_support_requests FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_support_requests.business_id
  AND m.user_id=auth.uid() AND (m.role='owner' OR business_support_requests.requested_by=auth.uid())));
CREATE POLICY member_role_audit_owner_read ON public.business_member_role_audit FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=business_member_role_audit.business_id
 AND m.user_id=auth.uid() AND m.role='owner'));

CREATE FUNCTION public.business_open_support_request(p_business uuid,p_kind text,p_subject text,
 p_details text,p_target uuid DEFAULT NULL,p_role text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role public.member_role;v_ticket uuid;
BEGIN
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR v_role IS NULL THEN RAISE EXCEPTION 'Business membership required' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN ('general','role_change') OR length(btrim(coalesce(p_subject,''))) NOT BETWEEN 5 AND 140
 OR length(btrim(coalesce(p_details,''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Invalid support request'; END IF;
 IF p_kind='role_change' THEN
  IF v_role<>'owner' OR p_target IS NULL OR p_role NOT IN ('manager','sales','inventory','finance','staff')
  OR NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=p_target AND role<>'owner') THEN
   RAISE EXCEPTION 'Business owner consent and an existing non-owner member are required' USING ERRCODE='42501'; END IF;
 ELSIF p_target IS NOT NULL OR p_role IS NOT NULL THEN RAISE EXCEPTION 'General requests cannot change roles'; END IF;
 INSERT INTO public.business_support_requests(business_id,requested_by,kind,subject,details,target_user_id,proposed_role)
 VALUES(p_business,auth.uid(),p_kind,btrim(p_subject),btrim(p_details),p_target,
  CASE WHEN p_kind='role_change' THEN p_role::public.member_role ELSE NULL END) RETURNING id INTO v_ticket;
 RETURN v_ticket;
END $$;

-- Direct role edit by a business owner; never grants owner and never changes platform admin status.
CREATE FUNCTION public.business_update_team_role(p_business uuid,p_member uuid,p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_before public.member_role;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role='owner')
 OR p_role NOT IN ('manager','sales','inventory','finance','staff') OR p_member=auth.uid() THEN
  RAISE EXCEPTION 'Business owner access required; owner promotion is not supported' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_before FROM public.business_members WHERE business_id=p_business AND user_id=p_member FOR UPDATE;
 IF NOT FOUND OR v_before='owner' THEN RAISE EXCEPTION 'Only existing non-owner members can be changed'; END IF;
 IF v_before=p_role::public.member_role THEN RETURN; END IF;
 UPDATE public.business_members SET role=p_role::public.member_role WHERE business_id=p_business AND user_id=p_member;
 INSERT INTO public.business_member_role_audit(business_id,member_id,previous_role,new_role,changed_by,source)
 VALUES(p_business,p_member,v_before,p_role::public.member_role,auth.uid(),'business_owner');
END $$;

-- Platform admin can view tickets without direct access to business private data.
CREATE FUNCTION public.platform_support_queue()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
  RAISE EXCEPTION 'Active platform admin required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'business_id',r.business_id,'business_name',b.name,
  'requested_by',r.requested_by,'kind',r.kind,'subject',r.subject,'details',r.details,
  'target_user_id',r.target_user_id,'proposed_role',r.proposed_role,'status',r.status,
  'admin_response',r.admin_response,'created_at',r.created_at) ORDER BY r.created_at DESC),'[]'::jsonb)
 INTO v_result FROM (SELECT * FROM public.business_support_requests ORDER BY created_at DESC LIMIT 80) r
 JOIN public.businesses b ON b.id=r.business_id;
 RETURN v_result;
END $$;

-- Owner-requested role changes are explicitly consented, targeted and audited.
-- This is assistance without customer impersonation or platform-admin bypass of ownership.
CREATE FUNCTION public.platform_resolve_support_request(p_ticket uuid,p_decision text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ticket public.business_support_requests%rowtype;v_before public.member_role;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND active) THEN
  RAISE EXCEPTION 'Active platform admin required' USING ERRCODE='42501'; END IF;
 IF p_decision NOT IN ('resolve','decline','apply_role') OR
 length(btrim(coalesce(p_note,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Provide a valid action and response'; END IF;
 SELECT * INTO v_ticket FROM public.business_support_requests WHERE id=p_ticket FOR UPDATE;
 IF NOT FOUND OR v_ticket.status<>'open' THEN RAISE EXCEPTION 'Support request is not open'; END IF;
 IF p_decision='apply_role' THEN
  IF v_ticket.kind<>'role_change' OR v_ticket.proposed_role='owner' OR NOT EXISTS(
   SELECT 1 FROM public.business_members WHERE business_id=v_ticket.business_id
   AND user_id=v_ticket.requested_by AND role='owner') THEN
   RAISE EXCEPTION 'A current business owner must have requested this specific role change' USING ERRCODE='42501'; END IF;
  SELECT role INTO v_before FROM public.business_members WHERE business_id=v_ticket.business_id
   AND user_id=v_ticket.target_user_id FOR UPDATE;
  IF NOT FOUND OR v_before='owner' THEN RAISE EXCEPTION 'Target must remain a non-owner business member'; END IF;
  IF v_before<>v_ticket.proposed_role THEN
   UPDATE public.business_members SET role=v_ticket.proposed_role
   WHERE business_id=v_ticket.business_id AND user_id=v_ticket.target_user_id;
   INSERT INTO public.business_member_role_audit(business_id,member_id,previous_role,new_role,changed_by,source,support_request_id)
   VALUES(v_ticket.business_id,v_ticket.target_user_id,v_before,v_ticket.proposed_role,auth.uid(),'platform_support',p_ticket);
  END IF;
 END IF;
 UPDATE public.business_support_requests SET status=CASE WHEN p_decision='decline' THEN 'declined' ELSE 'resolved' END,
  admin_response=btrim(p_note),handled_by=auth.uid(),handled_at=now() WHERE id=p_ticket;
END $$;
REVOKE ALL ON FUNCTION public.business_open_support_request(uuid,text,text,text,uuid,text),
 public.business_update_team_role(uuid,uuid,text),public.platform_support_queue(),
 public.platform_resolve_support_request(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_open_support_request(uuid,text,text,text,uuid,text),
 public.business_update_team_role(uuid,uuid,text),public.platform_support_queue(),
 public.platform_resolve_support_request(uuid,text,text) TO authenticated;
COMMIT;
