-- BusinessOS phase 1D tasks, reminders, team edits and read entry permissions.
BEGIN;
CREATE OR REPLACE FUNCTION public.business_dashboard_command(p_business uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_role text;
 v_now timestamp;
 v_from timestamptz;
 v_to timestamptz;
 v_prev timestamptz;

 v_order_now numeric:=0;
 v_order_prev numeric:=0;
 v_orders bigint:=0;

 v_received numeric:=0;
 v_received_prev numeric:=0;

 v_expenses numeric:=0;
 v_expenses_prev numeric:=0;

 v_outstanding numeric:=0;
 v_unpaid bigint:=0;
 v_partial bigint:=0;
 v_settled bigint:=0;
 v_late bigint:=0;
 v_stock bigint:=0;

 v_cost_covered bigint:=0;
 v_cost_unknown bigint:=0;
 v_manual_revenue numeric:=0;
 v_manual_cost numeric:=0;

 v_recent jsonb:='[]'::jsonb;
 v_pos jsonb;

BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'dashboard') OR NOT public.business_can_perform_action(p_business,'dashboard','view') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 SELECT role::text INTO v_role
 FROM public.business_members
 WHERE user_id=auth.uid()
  AND business_id=p_business;

 IF auth.uid() IS NULL OR v_role IS NULL THEN
  RAISE EXCEPTION
   'Business workspace access denied'
   USING ERRCODE='42501';
 END IF;

 -- Lagos local time
 v_now:=now() AT TIME ZONE 'Africa/Lagos';

 v_from:=date_trunc('month',v_now)
  AT TIME ZONE 'Africa/Lagos';

 v_to:=(
  date_trunc('month',v_now)+interval '1 month'
 ) AT TIME ZONE 'Africa/Lagos';

 v_prev:=(
  date_trunc('month',v_now)-interval '1 month'
 ) AT TIME ZONE 'Africa/Lagos';

 -- Sales
 SELECT
  coalesce(
   sum(total) FILTER(
    WHERE created_at>=v_from AND created_at<v_to
   ),0
  ),
  coalesce(
   sum(total) FILTER(
    WHERE created_at>=v_prev AND created_at<v_from
   ),0
  ),
  count(*) FILTER(
   WHERE created_at>=v_from AND created_at<v_to
  )
 INTO v_order_now,v_order_prev,v_orders
 FROM public.orders
 WHERE business_id=p_business
  AND status<>'cancelled'
  AND created_at>=v_prev
  AND created_at<v_to;

 -- Payments
 SELECT
  coalesce(
   sum(amount) FILTER(
    WHERE paid_at>=v_from AND paid_at<v_to
   ),0
  ),
  coalesce(
   sum(amount) FILTER(
    WHERE paid_at>=v_prev AND paid_at<v_from
   ),0
  )
 INTO v_received,v_received_prev
 FROM public.payments
 WHERE business_id=p_business
  AND status='completed'
  AND paid_at>=v_prev
  AND paid_at<v_to
  AND EXISTS(
   SELECT 1 FROM public.orders o
   WHERE o.id=payments.order_id
    AND o.business_id=p_business
    AND o.status<>'cancelled'
  );

 -- Expenses
 SELECT
  coalesce(
   sum(amount) FILTER(
    WHERE paid_at>=v_from AND paid_at<v_to
   ),0
  ),
  coalesce(
   sum(amount) FILTER(
    WHERE paid_at>=v_prev AND paid_at<v_from
   ),0
  )
 INTO v_expenses,v_expenses_prev
 FROM public.expenses
 WHERE business_id=p_business
  AND paid_at>=v_prev
  AND paid_at<v_to;

 -- Customer receivables
 WITH receivables AS (
  SELECT
   o.id,
   o.total,
   o.due_date,
   coalesce(
    (
     SELECT sum(p.amount)
     FROM public.payments p
     WHERE p.business_id=p_business
      AND p.order_id=o.id
      AND p.status='completed'
    ),0
   ) AS paid
  FROM public.orders o
  WHERE o.business_id=p_business
   AND o.status<>'cancelled'
 )
 SELECT
  coalesce(sum(greatest(0,total-paid)),0),
  count(*) FILTER(WHERE total>0 AND paid<=0),
  count(*) FILTER(WHERE total>paid AND paid>0),
  count(*) FILTER(WHERE total>0 AND paid>=total),
  count(*) FILTER(
   WHERE due_date IS NOT NULL
    AND due_date<
     (now() AT TIME ZONE 'Africa/Lagos')::date
    AND total>paid
  )
 INTO
  v_outstanding,
  v_unpaid,
  v_partial,
  v_settled,
  v_late
 FROM receivables;

 -- Low stock
 SELECT count(*) INTO v_stock
 FROM public.products
 WHERE business_id=p_business
  AND active
  AND track_inventory
  AND stock_quantity<=minimum_stock;

 -- Recent orders
 WITH recent AS (
  SELECT
   o.id,
   o.order_number,
   o.created_at,
   o.status,
   o.total,
   coalesce(
    (
     SELECT sum(p.amount)
     FROM public.payments p
     WHERE p.business_id=p_business
      AND p.order_id=o.id
      AND p.status='completed'
    ),0
   ) AS paid
  FROM public.orders o
  WHERE business_id=p_business
  ORDER BY created_at DESC,id DESC
  LIMIT 8
 )
 SELECT coalesce(
  jsonb_agg(
   jsonb_build_object(
    'id',id,
    'number',order_number,
    'created_at',created_at,
    'status',status,
    'total',total,
    'received',paid,
    'due',greatest(0,total-paid),
    'payment_status',
     CASE
      WHEN status='cancelled' THEN 'Cancelled'
      WHEN total<=0 THEN 'No charge'
      WHEN paid>=total THEN 'Paid'
      WHEN paid>0 THEN 'Part paid'
      ELSE 'Unpaid'
     END
   )
   ORDER BY created_at DESC,id DESC
  ),
  '[]'::jsonb
 )
 INTO v_recent
 FROM recent;

 -- Authorised financial reporting
 IF v_role IN ('owner','manager','finance')
 AND public.business_has_feature(
  p_business,'financial_reports'
 )
 THEN

  SELECT
   count(DISTINCT o.id)
    FILTER(WHERE ev.order_id IS NOT NULL),

   count(DISTINCT o.id)
    FILTER(WHERE ev.order_id IS NULL),

   coalesce(
    sum(o.subtotal-o.discount)
     FILTER(WHERE ev.order_id IS NOT NULL),
    0
   ),

   coalesce(
    sum(coalesce(oi.quantity*oi.unit_cost,0))
     FILTER(WHERE ev.order_id IS NOT NULL),
    0
   )

  INTO
   v_cost_covered,
   v_cost_unknown,
   v_manual_revenue,
   v_manual_cost

  FROM public.orders o

  LEFT JOIN public.business_pos_sales ps
   ON ps.order_id=o.id
   AND ps.business_id=p_business

  LEFT JOIN public.business_order_cost_evidence ev
   ON ev.order_id=o.id
   AND ev.business_id=p_business

  LEFT JOIN public.order_items oi
   ON oi.order_id=o.id

  WHERE o.business_id=p_business
   AND o.status<>'cancelled'
   AND ps.order_id IS NULL
   AND o.created_at>=v_from
   AND o.created_at<v_to;

  -- FIX: DO NOT REQUEST FUTURE REPORTING DATES

  v_pos:=public.business_pos_management_report(
   p_business,

   (v_from AT TIME ZONE 'Africa/Lagos')::date,

   least(
    (
     (v_to AT TIME ZONE 'Africa/Lagos')::date-1
    ),
    (now() AT TIME ZONE 'Africa/Lagos')::date
   )
  );

 END IF;

 -- Confidential information restrictions
 IF v_role NOT IN ('owner','manager','finance') THEN
  v_expenses:=NULL;
  v_expenses_prev:=NULL;
 END IF;

 IF v_role='staff' THEN
  v_order_now:=NULL;
  v_order_prev:=NULL;
  v_received:=NULL;
  v_received_prev:=NULL;
  v_outstanding:=NULL;
  v_recent:='[]'::jsonb;
 END IF;

 RETURN jsonb_build_object(
  'period_start',v_from,
  'role',v_role,

  'sales',v_order_now,
  'previous_sales',v_order_prev,
  'orders',v_orders,

  'received',v_received,
  'previous_received',v_received_prev,

  'expenses',v_expenses,
  'previous_expenses',v_expenses_prev,

  'outstanding',v_outstanding,
  'unpaid_count',v_unpaid,
  'partial_count',v_partial,
  'paid_count',v_settled,
  'overdue_count',v_late,
  'low_stock',v_stock,

  'recent_orders',v_recent,

  'manual_profit',
   CASE
    WHEN v_pos IS NULL THEN NULL
    ELSE jsonb_build_object(
     'revenue_with_cost_evidence',v_manual_revenue,
     'cost',v_manual_cost,
     'estimated_margin',
      v_manual_revenue-v_manual_cost,
     'covered_orders',v_cost_covered,
     'missing_cost_orders',v_cost_unknown
    )
   END,

  'pos_profit',
   CASE
    WHEN v_pos IS NULL THEN NULL
    ELSE jsonb_build_object(
     'estimated_margin',
      v_pos #> '{summary,estimated_item_margin_ex_vat}',
     'net_sales',
      v_pos #> '{summary,net_sales_ex_vat_after_credits}',
     'pos_orders',
      v_pos #> '{summary,orders}',
     'completed_credits',
      v_pos #> '{summary,gross_credited}'
    )
   END
 );

END;
$function$
;

CREATE OR REPLACE FUNCTION public.business_name_staff_member(p_business uuid, p_member uuid, p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'settings') OR NOT public.business_can_perform_action(p_business,'settings','edit') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.is_business_owner(p_business)
  OR NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=p_member)
  OR length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 100
 THEN RAISE EXCEPTION 'A valid team member and display name are required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.business_member_labels(business_id,user_id,display_name,changed_by)
 VALUES(p_business,p_member,btrim(p_name),auth.uid())
 ON CONFLICT(business_id,user_id) DO UPDATE SET display_name=excluded.display_name,changed_by=excluded.changed_by,updated_at=now();
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_pos_cash_exceptions(p_business uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_missing_sales bigint;v_missing_payments bigint;v_changed bigint;v_unmatched_refunds bigint;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','view') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
  AND role IN ('owner','manager','sales')) THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO v_missing_sales FROM public.business_pos_sales
 WHERE business_id=p_business AND shift_id IS NULL;
 SELECT count(*) INTO v_missing_payments FROM public.payments p
 WHERE p.business_id=p_business AND p.method='cash' AND p.status='completed'
  AND EXISTS(SELECT 1 FROM public.business_pos_sales s WHERE s.order_id=p.order_id AND s.business_id=p_business)
  AND NOT EXISTS(SELECT 1 FROM public.business_pos_shift_receipts r WHERE r.payment_id=p.id);
 SELECT count(*) INTO v_changed FROM public.business_pos_shift_receipts r
 JOIN public.payments p ON p.id=r.payment_id
 WHERE r.business_id=p_business AND (p.amount<>r.amount OR p.method<>'cash' OR p.status<>'completed');
 SELECT count(*) INTO v_unmatched_refunds FROM public.business_pos_refunds f
 WHERE f.business_id=p_business AND f.method='cash'
 AND NOT EXISTS(SELECT 1 FROM public.business_pos_cash_movements m
  WHERE m.business_id=p_business AND m.kind='cash_out' AND m.reference=f.external_reference AND m.amount=f.amount);
 RETURN jsonb_build_object('pos_sales_without_shift',v_missing_sales,
 'cash_payments_without_shift_receipt',v_missing_payments,'changed_cash_payment_records',v_changed,
 'cash_refunds_without_matching_cash_out',v_unmatched_refunds);
END $function$
;

CREATE OR REPLACE FUNCTION public.business_pos_daily_cash_report(p_business uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_result record;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','view') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager')) THEN
  RAISE EXCEPTION 'Owner or manager access required' USING ERRCODE='42501'; END IF;
 IF p_date IS NULL THEN RAISE EXCEPTION 'Report date is required'; END IF;
 SELECT count(*) AS shifts,
   count(*) FILTER(WHERE status='open') AS open_shifts,
   count(*) FILTER(WHERE status='closed') AS awaiting_review,
   count(*) FILTER(WHERE status='reviewed') AS reviewed,
   count(*) FILTER(WHERE status='flagged') AS flagged,
   coalesce(sum(sales_cash_total),0) AS captured_cash_in_closed_shifts,
   coalesce(sum(expected_cash) FILTER(WHERE closed_at IS NOT NULL),0) AS expected_at_close,
   coalesce(sum(counted_cash),0) AS counted_at_close,
   coalesce(sum(variance),0) AS net_variance
 INTO v_result FROM public.business_pos_cashier_shifts
 WHERE business_id=p_business AND (opened_at AT TIME ZONE 'Africa/Lagos')::date=p_date;
 RETURN jsonb_build_object('day',p_date,'shifts',v_result.shifts,'open_shifts',v_result.open_shifts,
 'awaiting_review',v_result.awaiting_review,'reviewed',v_result.reviewed,'flagged',v_result.flagged,
 'closed_shift_captured_cash',v_result.captured_cash_in_closed_shifts,
 'expected_at_close',v_result.expected_at_close,'counted_at_close',v_result.counted_at_close,
 'net_variance',v_result.net_variance);
END $function$
;

CREATE OR REPLACE FUNCTION public.business_pos_management_report(p_business uuid, p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_summary jsonb;v_products jsonb;v_locations jsonb;
 v_start timestamptz;v_end timestamptz;
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','view') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'financial_reports') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager','finance')) THEN
  RAISE EXCEPTION 'Financial reporting permission required' USING ERRCODE='42501'; END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_start>p_end OR p_end-p_start>91 OR p_end>current_date+1 THEN
  RAISE EXCEPTION 'Select a valid reporting period of 92 days or less'; END IF;
 v_start:=p_start::timestamp AT TIME ZONE 'Africa/Lagos';
 v_end:=(p_end+1)::timestamp AT TIME ZONE 'Africa/Lagos';
 WITH sale AS MATERIALIZED (
  SELECT o.id,o.total,o.subtotal,o.discount,o.tax,o.delivery_fee,s.location_id
  FROM public.orders o JOIN public.business_pos_sales s ON s.order_id=o.id AND s.business_id=o.business_id
  WHERE o.business_id=p_business AND o.created_at>=v_start AND o.created_at<v_end AND o.status<>'cancelled'
 ), sale_totals AS (
  SELECT count(*) AS orders,coalesce(sum(total),0) AS gross_order_total,
   coalesce(sum(subtotal-discount),0) AS net_sale_ex_vat,
   coalesce(sum(tax),0) AS recorded_vat,
   count(*) FILTER(WHERE location_id IS NULL) AS unallocated_sale_count FROM sale
 ), credit AS (
  SELECT coalesce(sum(r.net_credit),0) AS net_credit,coalesce(sum(r.vat_credit),0) AS vat_credit,
   coalesce(sum(r.gross_credit),0) AS gross_credit,count(*) AS credits
  FROM public.business_pos_returns r JOIN sale s ON s.id=r.order_id WHERE r.business_id=p_business AND r.status='completed'
 ), paid AS (
  SELECT coalesce(sum(p.amount),0) AS recorded_payments FROM public.payments p JOIN sale s ON s.id=p.order_id
  WHERE p.business_id=p_business AND p.status='completed'
 ), cogs AS (
  SELECT coalesce(sum(oi.quantity*oi.unit_cost),0) AS gross_cost FROM public.order_items oi JOIN sale s ON s.id=oi.order_id
 ), recovered AS (
  SELECT coalesce(sum(r.quantity*oi.unit_cost),0) AS returned_cost FROM public.business_pos_returns r
  JOIN sale s ON s.id=r.order_id JOIN public.order_items oi ON oi.id=r.order_item_id
  WHERE r.business_id=p_business AND r.status='completed'
 )
 SELECT jsonb_build_object('orders',t.orders,'gross_order_total',t.gross_order_total,
   'net_sales_ex_vat_after_credits',t.net_sale_ex_vat-c.net_credit,
   'vat_recorded',t.recorded_vat,'vat_credited',c.vat_credit,
   'gross_credited',c.gross_credit,'credit_count',c.credits,
   'recorded_payments_for_sold_orders',p.recorded_payments,
   'estimated_cost_net_returns',g.gross_cost-r.returned_cost,
   'estimated_item_margin_ex_vat',t.net_sale_ex_vat-c.net_credit-g.gross_cost+r.returned_cost,
   'unallocated_sale_count',t.unallocated_sale_count)
 INTO v_summary FROM sale_totals t CROSS JOIN credit c CROSS JOIN paid p CROSS JOIN cogs g CROSS JOIN recovered r;
 WITH sale AS MATERIALIZED (
  SELECT o.id FROM public.orders o JOIN public.business_pos_sales s ON s.order_id=o.id AND s.business_id=o.business_id
  WHERE o.business_id=p_business AND o.created_at>=v_start AND o.created_at<v_end AND o.status<>'cancelled'
 ), line AS (
  SELECT oi.id,oi.product_id,oi.name_snapshot,oi.quantity,oi.unit_cost,
    coalesce(tl.taxable_base,oi.line_total) AS line_net
  FROM public.order_items oi JOIN sale s ON s.id=oi.order_id
  LEFT JOIN public.business_pos_tax_lines tl ON tl.order_id=oi.order_id AND tl.product_id=oi.product_id
 ), returned AS (
  SELECT r.order_item_id, sum(r.quantity) AS quantity,sum(r.net_credit) AS net_credit FROM public.business_pos_returns r
  JOIN sale s ON s.id=r.order_id WHERE r.business_id=p_business AND r.status='completed'
  GROUP BY r.order_item_id
 ), ranked AS (
  SELECT l.product_id, l.name_snapshot AS product_name,
   sum(l.quantity-coalesce(r.quantity,0)) AS net_units,
   sum(l.line_net-coalesce(r.net_credit,0)) AS net_sales_ex_vat,
   sum((l.quantity-coalesce(r.quantity,0))*l.unit_cost) AS estimated_cost,
   sum(l.line_net-coalesce(r.net_credit,0)-(l.quantity-coalesce(r.quantity,0))*l.unit_cost) AS estimated_margin
  FROM line l LEFT JOIN returned r ON r.order_item_id=l.id GROUP BY l.product_id,l.name_snapshot
  ORDER BY sum(l.line_net-coalesce(r.net_credit,0)) DESC LIMIT 20
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'product_name',product_name,'net_units',net_units,
 'net_sales_ex_vat',net_sales_ex_vat,'estimated_cost',estimated_cost,'estimated_margin',estimated_margin)
 ORDER BY net_sales_ex_vat DESC),'[]'::jsonb) INTO v_products FROM ranked;
 WITH locations AS (
  SELECT coalesce(l.name,'Historic / unassigned') AS label,count(o.id) AS orders,coalesce(sum(o.total),0) AS gross_total
  FROM public.orders o JOIN public.business_pos_sales s ON s.order_id=o.id AND s.business_id=o.business_id
  LEFT JOIN public.business_stock_locations l ON l.id=s.location_id AND l.business_id=o.business_id
  WHERE o.business_id=p_business AND o.created_at>=v_start AND o.created_at<v_end AND o.status<>'cancelled'
  GROUP BY coalesce(l.name,'Historic / unassigned') ORDER BY coalesce(sum(o.total),0) DESC LIMIT 20
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('location',label,'orders',orders,'gross_total',gross_total)
 ORDER BY gross_total DESC),'[]'::jsonb) INTO v_locations FROM locations;
 RETURN jsonb_build_object('period_start',p_start,'period_end',p_end,'basis','POS sale-date cohort',
  'summary',coalesce(v_summary,'{}'::jsonb),'products',coalesce(v_products,'[]'::jsonb),
  'locations',coalesce(v_locations,'[]'::jsonb),'bounded',true);
END $function$
;

CREATE OR REPLACE FUNCTION public.business_pos_shift_totals(p_business uuid, p_shift uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_s record;v_receipts numeric(14,2);v_in numeric(14,2);v_out numeric(14,2);
BEGIN
 IF NOT public.business_has_feature(p_business,'pos') OR NOT public.business_can_perform_action(p_business,'pos','view') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_s FROM public.business_pos_cashier_shifts WHERE business_id=p_business AND id=p_shift;
 IF NOT FOUND OR (v_s.cashier_id<>auth.uid() AND NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager'))) THEN
  RAISE EXCEPTION 'Shift not found or access denied' USING ERRCODE='42501'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_receipts FROM public.business_pos_shift_receipts WHERE shift_id=p_shift;
 SELECT coalesce(sum(amount) FILTER(WHERE kind='cash_in'),0),
        coalesce(sum(amount) FILTER(WHERE kind='cash_out'),0)
 INTO v_in,v_out FROM public.business_pos_cash_movements WHERE shift_id=p_shift;
 RETURN jsonb_build_object('opening',v_s.opening_cash,'cash_sales_and_receipts',v_receipts,
  'cash_in',v_in,'cash_out',v_out,'expected',v_s.opening_cash+v_receipts+v_in-v_out,
  'status',v_s.status,'counted',v_s.counted_cash,'variance',v_s.variance);
END $function$
;

CREATE OR REPLACE FUNCTION public.business_post_team_update(p_business uuid, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'team') OR NOT public.business_can_perform_action(p_business,'team','create') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'This business is not available to your account' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_body,''))) NOT BETWEEN 1 AND 2000 THEN
  RAISE EXCEPTION 'Enter a message with up to 2000 characters'; END IF;
 INSERT INTO public.business_team_updates(business_id,author_id,body)
 VALUES(p_business,auth.uid(),btrim(p_body)) RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_reserve_order_reminder(p_business uuid, p_order uuid, p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;v_total numeric;v_paid numeric;v_status text;v_customer uuid;
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'orders') OR NOT public.business_can_perform_action(p_business,'orders','edit') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=p_business
 AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales'))
 THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
 SELECT total,status,customer_id INTO v_total,v_status,v_customer FROM public.orders
 WHERE business_id=p_business AND id=p_order FOR UPDATE;
 IF NOT FOUND OR v_status='cancelled' OR v_customer IS NULL THEN RAISE EXCEPTION 'Order unavailable'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE business_id=p_business AND order_id=p_order AND status='completed';
 IF greatest(0,coalesce(v_total,0)-v_paid)<=0 THEN RAISE EXCEPTION 'No outstanding balance'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_customers bc JOIN public.customers c ON c.id=bc.customer_id
 WHERE bc.business_id=p_business AND bc.customer_id=v_customer
 AND c.email IS NOT NULL AND lower(c.email)=lower(p_email)) THEN RAISE EXCEPTION 'Recipient unavailable'; END IF;
 INSERT INTO public.business_order_reminders(business_id,order_id,recipient_email,sent_by)
 VALUES(p_business,p_order,p_email,auth.uid()) ON CONFLICT(business_id,order_id,reminder_date) DO NOTHING
 RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_save_task(p_business uuid, p_title text, p_details text, p_assigned uuid, p_due_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_role public.member_role;v_id uuid;
BEGIN
 IF NOT public.business_has_feature(p_business,'team') OR NOT public.business_can_perform_action(p_business,'team','create') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL OR v_role NOT IN ('owner','manager') THEN RAISE EXCEPTION 'Manager access required' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180 OR length(coalesce(p_details,''))>1500
  OR (p_assigned IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=p_assigned))
 THEN RAISE EXCEPTION 'Please check task details'; END IF;
 INSERT INTO public.business_tasks(business_id,title,details,assigned_to,created_by,due_on)
 VALUES(p_business,btrim(p_title),btrim(coalesce(p_details,'')),p_assigned,auth.uid(),p_due_on) RETURNING id INTO v_id;
 RETURN v_id;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_set_task_completed(p_business uuid, p_task uuid, p_completed boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_task public.business_tasks%ROWTYPE;v_role public.member_role;
BEGIN
 IF NOT public.business_has_feature(p_business,'team') OR NOT public.business_can_perform_action(p_business,'team','edit') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_task FROM public.business_tasks WHERE business_id=p_business AND id=p_task FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task unavailable'; END IF;
 IF v_role NOT IN ('owner','manager') AND coalesce(v_task.assigned_to,v_task.created_by)<>auth.uid()
 THEN RAISE EXCEPTION 'Task access denied' USING ERRCODE='42501'; END IF;
 UPDATE public.business_tasks SET completed_at=CASE WHEN p_completed THEN now() ELSE NULL END,updated_at=now()
 WHERE id=p_task AND business_id=p_business;
END;$function$
;

CREATE OR REPLACE FUNCTION public.business_update_team_role(p_business uuid, p_member uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_before public.member_role;
BEGIN
 IF NOT public.business_plan_core_feature_allowed(p_business,'settings') OR NOT public.business_can_perform_action(p_business,'settings','edit') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role='owner')
 OR p_role NOT IN ('manager','sales','inventory','finance','staff') OR p_member=auth.uid() THEN
  RAISE EXCEPTION 'Business owner access required; owner promotion is not supported' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_before FROM public.business_members WHERE business_id=p_business AND user_id=p_member FOR UPDATE;
 IF NOT FOUND OR v_before='owner' THEN RAISE EXCEPTION 'Only existing non-owner members can be changed'; END IF;
 IF v_before=p_role::public.member_role THEN RETURN; END IF;
 UPDATE public.business_members SET role=p_role::public.member_role WHERE business_id=p_business AND user_id=p_member;
 INSERT INTO public.business_member_role_audit(business_id,member_id,previous_role,new_role,changed_by,source)
 VALUES(p_business,p_member,v_before,p_role::public.member_role,auth.uid(),'business_owner');
END $function$
;

CREATE OR REPLACE FUNCTION public.business_wholesale_price_quote(p_business uuid, p_product uuid, p_qty numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_regular numeric(14,2);v_price numeric(14,2);v_threshold numeric(14,3);
BEGIN
 IF NOT public.business_has_feature(p_business,'purchasing') OR NOT public.business_can_perform_action(p_business,'purchasing','view') THEN RAISE EXCEPTION 'Plan or role permission denied' USING ERRCODE='42501'; END IF;
 
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager','sales')) THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 IF p_qty IS NULL OR p_qty<=0 OR p_qty>1000000 OR round(p_qty,3)<>p_qty THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
 SELECT selling_price INTO v_regular FROM public.products WHERE business_id=p_business AND id=p_product AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not available'; END IF;
 SELECT unit_price,min_quantity INTO v_price,v_threshold FROM public.business_wholesale_price_tiers
 WHERE business_id=p_business AND product_id=p_product AND min_quantity<=p_qty
 ORDER BY min_quantity DESC LIMIT 1;
 RETURN jsonb_build_object('quantity',p_qty,'regular_unit_price',v_regular,
   'suggested_unit_price',LEAST(v_regular,coalesce(v_price,v_regular)),
   'tier_min_quantity',v_threshold,'is_advisory',true,'currency','NGN');
END $function$
;
COMMIT;