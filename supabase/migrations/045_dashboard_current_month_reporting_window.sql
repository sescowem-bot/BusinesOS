-- BusinessOS SQL 045 | Fix dashboard requesting future dates from the POS report.
-- Install ONCE after SQL 044, after checking the earlier migrations in staging.
-- This changes only the dashboard summary function. It does not change orders, payments or invoices.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.business_dashboard_command(uuid)') IS NULL OR
    to_regprocedure('public.business_pos_management_report(uuid,date,date)') IS NULL OR
    to_regclass('public.business_company_role_profiles') IS NULL THEN
  RAISE EXCEPTION 'Missing prerequisites: check SQL 041, 042, 043 and 044 before applying SQL 045';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.business_dashboard_command(p_business uuid)
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
   least(((v_to AT TIME ZONE 'Africa/Lagos')::date-1),(now() AT TIME ZONE 'Africa/Lagos')::date));
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
COMMIT;
