-- BusinessOS Phase 030K (bounded): partial PO receiving + evidence-based supplier bills/payments.
-- Apply ONCE after 037, in staging first. Never backfills cash payments or general-ledger entries.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_purchase_orders') IS NULL
 OR to_regclass('public.business_purchase_items') IS NULL
 OR to_regclass('public.inventory_movements') IS NULL
 OR to_regclass('public.business_pos_cashier_shifts') IS NULL
 THEN RAISE EXCEPTION 'Missing prerequisites: migrations 031 through 037 must be installed'; END IF;
 IF to_regclass('public.business_purchase_receipts') IS NOT NULL
 THEN RAISE EXCEPTION 'Phase 038 already exists. Inspect current schema instead of rerunning'; END IF;
END $$;

ALTER TABLE public.business_purchase_items
 ADD COLUMN received_quantity numeric(14,3) NOT NULL DEFAULT 0;
-- Legacy orders marked received under SQL 031 were fully received.
UPDATE public.business_purchase_items i SET received_quantity=i.quantity
 FROM public.business_purchase_orders o WHERE o.id=i.purchase_id AND o.status='received';
ALTER TABLE public.business_purchase_items ADD CONSTRAINT business_purchase_items_received_bounds
 CHECK(received_quantity>=0 AND received_quantity<=quantity);
ALTER TABLE public.business_purchase_orders DROP CONSTRAINT IF EXISTS business_purchase_orders_status_check;
ALTER TABLE public.business_purchase_orders ADD CONSTRAINT business_purchase_orders_status_check
 CHECK(status IN ('draft','partially_received','received'));

CREATE TABLE public.business_purchase_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 purchase_id uuid NOT NULL,
 request_id uuid NOT NULL,
 note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 received_by uuid NOT NULL REFERENCES auth.users(id),
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,business_id),UNIQUE(business_id,request_id),
 FOREIGN KEY(purchase_id,business_id) REFERENCES public.business_purchase_orders(id,business_id)
);
CREATE INDEX purchase_receipts_by_order ON public.business_purchase_receipts(business_id,purchase_id,received_at DESC);
CREATE TABLE public.business_purchase_receipt_lines (
 receipt_id uuid NOT NULL REFERENCES public.business_purchase_receipts(id) ON DELETE RESTRICT,
 purchase_item_id uuid NOT NULL REFERENCES public.business_purchase_items(id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 received_quantity numeric(14,3) NOT NULL CHECK(received_quantity>0),
 unit_cost_at_receipt numeric(14,2) NOT NULL CHECK(unit_cost_at_receipt>=0),
 PRIMARY KEY(receipt_id,purchase_item_id)
);

-- Supplier bills must be explicitly entered from received supplier documents.
-- Purchase value is NOT an automatically established account payable.
CREATE TABLE public.business_supplier_bills (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 supplier_id uuid NOT NULL,
 purchase_id uuid NOT NULL,
 supplier_invoice_number text NOT NULL CHECK(length(btrim(supplier_invoice_number)) BETWEEN 1 AND 100),
 invoice_amount numeric(14,2) NOT NULL CHECK(invoice_amount>0 AND invoice_amount<=99999999999.99),
 issued_on date NOT NULL, due_on date,
 note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,business_id), UNIQUE(business_id,supplier_id,supplier_invoice_number),
 FOREIGN KEY(supplier_id,business_id) REFERENCES public.business_suppliers(id,business_id),
 FOREIGN KEY(purchase_id,business_id) REFERENCES public.business_purchase_orders(id,business_id),
 CHECK(due_on IS NULL OR due_on>=issued_on)
);
CREATE INDEX supplier_bills_by_business ON public.business_supplier_bills(business_id,created_at DESC);
CREATE TABLE public.business_supplier_bill_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 bill_id uuid NOT NULL,
 request_id uuid NOT NULL,
 amount numeric(14,2) NOT NULL CHECK(amount>0 AND amount<=99999999999.99),
 method text NOT NULL CHECK(method IN ('cash','transfer','external_pos','other')),
 reference text NOT NULL CHECK(length(btrim(reference)) BETWEEN 3 AND 150),
 paid_on date NOT NULL,
 recorded_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,request_id),
 FOREIGN KEY(bill_id,business_id) REFERENCES public.business_supplier_bills(id,business_id)
);
CREATE INDEX supplier_bill_payments_lookup ON public.business_supplier_bill_payments(business_id,bill_id,created_at DESC);

ALTER TABLE public.business_purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_purchase_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_supplier_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_supplier_bill_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_purchase_receipts, public.business_purchase_receipt_lines,
 public.business_supplier_bills, public.business_supplier_bill_payments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_purchase_receipts, public.business_purchase_receipt_lines,
 public.business_supplier_bills, public.business_supplier_bill_payments TO authenticated;
CREATE POLICY purchase_receipts_read ON public.business_purchase_receipts FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'purchasing'));
CREATE POLICY purchase_receipt_lines_read ON public.business_purchase_receipt_lines FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.business_purchase_receipts r WHERE r.id=receipt_id
 AND public.business_has_feature(r.business_id,'purchasing')));
-- Supplier billing details are restricted to management, not all purchasing staff.
CREATE POLICY supplier_bills_read ON public.business_supplier_bills FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'purchasing') AND EXISTS(
 SELECT 1 FROM public.business_members m WHERE m.business_id=business_supplier_bills.business_id
 AND m.user_id=auth.uid() AND m.role IN ('owner','manager')));
CREATE POLICY supplier_payments_read ON public.business_supplier_bill_payments FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'purchasing') AND EXISTS(
 SELECT 1 FROM public.business_members m WHERE m.business_id=business_supplier_bill_payments.business_id
 AND m.user_id=auth.uid() AND m.role IN ('owner','manager')));

-- Each receipt is processed atomically. The purchase-order lock serializes concurrent receipts.
CREATE FUNCTION public.business_receive_purchase_partial(
 p_business uuid,p_purchase uuid,p_request uuid,p_lines jsonb,p_note text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_po public.business_purchase_orders%rowtype;v_existing uuid;v_receipt uuid;
 v_line record;v_item public.business_purchase_items%rowtype;v_product public.products%rowtype;
 v_item_id uuid;v_qty numeric;v_seen uuid[]:=ARRAY[]::uuid[];v_count integer:=0;
 v_total integer;v_done integer;
BEGIN
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
END;$$;

-- Keep the old full-receipt RPC compatible for legacy screens/scripts, while respecting prior partial receipts.
CREATE OR REPLACE FUNCTION public.business_receive_purchase(p_business uuid,p_purchase uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_lines jsonb;v_id uuid;
BEGIN
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
END;$$;

CREATE FUNCTION public.business_record_supplier_bill(
 p_business uuid,p_purchase uuid,p_reference text,p_amount numeric,p_issued date,p_due date,p_note text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_po public.business_purchase_orders%rowtype;v_id uuid;
BEGIN
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
END;$$;

-- Records payment confirmation only; does not initiate transfer or create GL entries.
CREATE FUNCTION public.business_record_supplier_payment(
 p_business uuid,p_bill uuid,p_request uuid,p_amount numeric,p_method text,p_reference text,p_paid_on date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_bill public.business_supplier_bills%rowtype;v_existing record;v_paid numeric(14,2);v_id uuid;
BEGIN
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
END;$$;

REVOKE ALL ON FUNCTION public.business_receive_purchase_partial(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.business_receive_purchase(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.business_record_supplier_bill(uuid,uuid,text,numeric,date,date,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.business_record_supplier_payment(uuid,uuid,uuid,numeric,text,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_receive_purchase_partial(uuid,uuid,uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_receive_purchase(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_record_supplier_bill(uuid,uuid,text,numeric,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_record_supplier_payment(uuid,uuid,uuid,numeric,text,text,date) TO authenticated;
COMMIT;
