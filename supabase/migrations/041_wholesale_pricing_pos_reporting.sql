-- BusinessOS Phase 030M-A: wholesale reference price tiers and indexed POS operational reports.
-- Requires 040. Does not alter POS selling prices, tax decisions, invoices, or historical orders.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_pos_split_checkouts') IS NULL OR to_regclass('public.business_pos_sales') IS NULL OR
    to_regclass('public.business_pos_returns') IS NULL THEN
    RAISE EXCEPTION 'Migration 040 and preceding POS migrations must be installed before 041';
 END IF;
 IF to_regclass('public.business_wholesale_price_tiers') IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 041 already exists or was partially installed; inspect before rerunning';
 END IF;
END $$;

CREATE TABLE public.business_wholesale_price_tiers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
 min_quantity numeric(14,3) NOT NULL CHECK(min_quantity>=2 AND min_quantity<=1000000),
 unit_price numeric(14,2) NOT NULL CHECK(unit_price>0 AND unit_price<=9999999999),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=250),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,product_id,min_quantity)
);
CREATE INDEX wholesale_tier_product_lookup ON public.business_wholesale_price_tiers(business_id,product_id,min_quantity DESC);
ALTER TABLE public.business_wholesale_price_tiers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_wholesale_price_tiers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_wholesale_price_tiers TO authenticated;
CREATE POLICY wholesale_tier_member_read ON public.business_wholesale_price_tiers FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'pos'));

CREATE FUNCTION public.business_set_wholesale_price_tier(
 p_business uuid,p_product uuid,p_min_qty numeric,p_price numeric,p_note text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_product public.products%rowtype;v_id uuid;
BEGIN
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
END $$;
CREATE FUNCTION public.business_delete_wholesale_price_tier(p_business uuid,p_tier uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
   SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid() AND role IN ('owner','manager')) THEN
   RAISE EXCEPTION 'Only POS owners and managers may remove wholesale tiers' USING ERRCODE='42501'; END IF;
 DELETE FROM public.business_wholesale_price_tiers WHERE business_id=p_business AND id=p_tier;
 IF NOT FOUND THEN RAISE EXCEPTION 'Price tier not found'; END IF;
END $$;
-- A quote is advisory. It does NOT mutate a POS sale or bypass reviewed VAT checkout.
CREATE FUNCTION public.business_wholesale_price_quote(p_business uuid,p_product uuid,p_qty numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_regular numeric(14,2);v_price numeric(14,2);v_threshold numeric(14,3);
BEGIN
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
END $$;

-- Restrict report windows to 92 days, return only bounded JSON summaries. This avoids
-- transferring full customer, order, payment and stock records to the browser.
CREATE INDEX orders_business_created_retail ON public.orders(business_id,created_at,id);
CREATE INDEX pos_sales_business_order_report ON public.business_pos_sales(business_id,order_id);
CREATE INDEX pos_returns_order_report ON public.business_pos_returns(business_id,order_id,status);
CREATE INDEX pos_payments_business_order_status ON public.payments(business_id,order_id,status);
CREATE INDEX pos_order_items_order_report ON public.order_items(order_id,product_id);
CREATE FUNCTION public.business_pos_management_report(p_business uuid,p_start date,p_end date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_summary jsonb;v_products jsonb;v_locations jsonb;
 v_start timestamptz;v_end timestamptz;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.business_set_wholesale_price_tier(uuid,uuid,numeric,numeric,text),
 public.business_delete_wholesale_price_tier(uuid,uuid),
 public.business_wholesale_price_quote(uuid,uuid,numeric),
 public.business_pos_management_report(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_set_wholesale_price_tier(uuid,uuid,numeric,numeric,text),
 public.business_delete_wholesale_price_tier(uuid,uuid),
 public.business_wholesale_price_quote(uuid,uuid,numeric),
 public.business_pos_management_report(uuid,date,date) TO authenticated;
COMMIT;
