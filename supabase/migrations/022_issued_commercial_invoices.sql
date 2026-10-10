-- Phase 024 / migration 022: immutable, tenant-bound commercial invoice snapshots.
-- Run ONCE after earlier migrations. Does not backfill or change historical orders.
-- These are commercial invoices, NOT validated Nigerian VAT/e-invoices.
BEGIN;

CREATE TABLE public.business_invoice_counters (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_year integer NOT NULL CHECK (invoice_year BETWEEN 2020 AND 9999),
  last_number bigint NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY(business_id, invoice_year)
);

CREATE TABLE public.business_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid NOT NULL REFERENCES auth.users(id),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  UNIQUE(business_id, order_id),
  UNIQUE(business_id, invoice_number)
);
CREATE INDEX idx_business_invoices_recent ON public.business_invoices(business_id, issued_at DESC);

ALTER TABLE public.business_invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_invoices ENABLE ROW LEVEL SECURITY;

-- No direct client writes. A validated transaction below is the only client issuance path.
REVOKE ALL ON public.business_invoice_counters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.business_invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_invoices TO authenticated;
CREATE POLICY invoice_tenant_read ON public.business_invoices FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));

CREATE FUNCTION public.issue_business_invoice(p_business uuid, p_order uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
$$;
REVOKE ALL ON FUNCTION public.issue_business_invoice(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_business_invoice(uuid,uuid) TO authenticated;
COMMIT;
