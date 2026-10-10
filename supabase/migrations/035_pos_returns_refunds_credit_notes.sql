-- Phase 030I | Controlled returns for fully-paid, single-currency POS sales.
-- Apply ONCE after SQL 034, in staging first. Never modifies original orders, payments or issued invoices.
-- Refunds are externally confirmed RECORDS, not card/bank gateway operations.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_pos_pricing_contexts') IS NULL OR
    to_regclass('public.business_pos_tax_lines') IS NULL OR
    to_regclass('public.business_pos_sales') IS NULL OR
    to_regclass('public.inventory_movements') IS NULL THEN
   RAISE EXCEPTION 'Migrations through 034 are required before 035';
 END IF;
 IF to_regclass('public.business_pos_returns') IS NOT NULL THEN
   RAISE EXCEPTION 'SQL 035 already installed or partially present; inspect before reapplying';
 END IF;
END $$;

CREATE TABLE public.business_pos_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
 order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
 quantity numeric(14,3) NOT NULL CHECK(quantity>0),
 net_credit numeric(14,2) NOT NULL CHECK(net_credit>=0),
 vat_credit numeric(14,2) NOT NULL CHECK(vat_credit>=0),
 gross_credit numeric(14,2) GENERATED ALWAYS AS (net_credit+vat_credit) STORED,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 500),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','completed')),
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 completed_by uuid REFERENCES auth.users(id),
 completed_at timestamptz,
 restocked boolean,
 UNIQUE(business_id,request_id), UNIQUE(id,business_id)
);
-- One open request per *sale item*; reservations released when rejected/completed.
CREATE UNIQUE INDEX business_pos_returns_open_item ON public.business_pos_returns(order_item_id)
 WHERE status IN ('requested','approved');
CREATE INDEX business_pos_returns_business_recent ON public.business_pos_returns(business_id,requested_at DESC);
CREATE INDEX business_pos_returns_item_completed ON public.business_pos_returns(order_item_id,status);

CREATE TABLE public.business_pos_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 return_id uuid NOT NULL UNIQUE,
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 method text NOT NULL CHECK(method IN ('cash','transfer','external_pos','external_card','other')),
 external_reference text NOT NULL CHECK(length(btrim(external_reference)) BETWEEN 3 AND 150),
 confirmed_by uuid NOT NULL REFERENCES auth.users(id),
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(return_id,business_id) REFERENCES public.business_pos_returns(id,business_id) ON DELETE RESTRICT
);
CREATE TABLE public.business_pos_credit_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 return_id uuid NOT NULL UNIQUE,
 credit_number text NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT now(),
 issued_by uuid NOT NULL REFERENCES auth.users(id),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 FOREIGN KEY(return_id,business_id) REFERENCES public.business_pos_returns(id,business_id) ON DELETE RESTRICT,
 UNIQUE(business_id,credit_number)
);
CREATE INDEX business_pos_credit_notes_recent ON public.business_pos_credit_notes(business_id,issued_at DESC);

-- SELECT only; mutations must use guarded SECURITY DEFINER RPCs.
ALTER TABLE public.business_pos_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_pos_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_pos_credit_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_pos_returns,public.business_pos_refunds,public.business_pos_credit_notes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_pos_returns,public.business_pos_refunds,public.business_pos_credit_notes TO authenticated;
CREATE POLICY pos_returns_member_read ON public.business_pos_returns FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'pos'));
CREATE POLICY pos_refunds_member_read ON public.business_pos_refunds FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'pos'));
CREATE POLICY pos_credit_notes_member_read ON public.business_pos_credit_notes FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'pos'));

-- Request a return. Item + order are locked so parallel requests cannot exceed original quantity.
-- Only completely paid POS sales qualify. Exact cent allocations use the cumulative
-- fulfilled quantity so the LAST partial return receives any rounding remainder.
CREATE FUNCTION public.business_request_pos_return(
 p_business uuid,p_order uuid,p_item uuid,p_quantity numeric,p_reason text,p_request uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_order record;v_line record;v_tax record;v_prior numeric(14,3);
 v_paid numeric(14,2);v_tax_count integer;v_item_count integer;
 v_net_total numeric(14,2);v_vat_total numeric(14,2);
 v_net numeric(14,2);v_vat numeric(14,2);v_id uuid;v_previous uuid;v_currency text;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.business_request_pos_return(uuid,uuid,uuid,numeric,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_request_pos_return(uuid,uuid,uuid,numeric,text,uuid) TO authenticated;

-- Separate approval from a cashier request. Owners may self-review in a sole-owner business.
CREATE FUNCTION public.business_review_pos_return(p_business uuid,p_return uuid,p_approve boolean,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row record;v_role text;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.business_review_pos_return(uuid,uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_review_pos_return(uuid,uuid,boolean,text) TO authenticated;

-- Only after an externally verified refund, record a credit note and optional restock atomically.
-- Never mutates original invoice, original positive payments, or order totals.
CREATE FUNCTION public.business_complete_pos_return(
 p_business uuid,p_return uuid,p_method text,p_reference text,p_restock boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row record;v_sale record;v_item record;v_product record;v_note uuid;v_document text;
 v_tax_treatment text;v_tax_rate integer;v_original_invoice text;v_brand text;v_customer text;v_identity record;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.business_complete_pos_return(uuid,uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_complete_pos_return(uuid,uuid,text,text,boolean) TO authenticated;
COMMIT;
