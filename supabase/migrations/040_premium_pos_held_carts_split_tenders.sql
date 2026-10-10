-- Phase 030L: premium POS carts and split recorded tenders.
-- Requires SQL 039. Run once in staging. No bank/card collection is initiated.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.business_pos_checkout_at_location(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text,text,numeric,uuid)') IS NULL
 OR to_regprocedure('public.crm_record_payment(uuid,uuid,numeric,public.payment_method,text)') IS NULL THEN
  RAISE EXCEPTION 'Apply SQL migrations through 039 before 040';
 END IF;
 IF to_regclass('public.business_pos_held_carts') IS NOT NULL THEN
  RAISE EXCEPTION 'Phase 040 already installed or partially installed; inspect before retrying';
 END IF;
END $$;

CREATE TABLE public.business_pos_held_carts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 cashier_id uuid NOT NULL REFERENCES auth.users(id),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 2 AND 80),
 location_id uuid NOT NULL,
 customer_id uuid,
 basket jsonb NOT NULL CHECK(jsonb_typeof(basket)='array' AND jsonb_array_length(basket) BETWEEN 1 AND 30),
 price_mode text NOT NULL CHECK(price_mode IN ('inclusive','exclusive')),
 discount numeric(14,2) NOT NULL DEFAULT 0 CHECK(discount>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(location_id,business_id) REFERENCES public.business_stock_locations(id,business_id)
);
CREATE INDEX business_pos_held_carts_owner_idx ON public.business_pos_held_carts(business_id,cashier_id,updated_at DESC);
ALTER TABLE public.business_pos_held_carts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_pos_held_carts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_pos_held_carts TO authenticated;
CREATE POLICY pos_held_carts_own_read ON public.business_pos_held_carts FOR SELECT TO authenticated
 USING(cashier_id=auth.uid() AND public.business_has_feature(business_id,'pos'));

CREATE FUNCTION public.business_save_pos_cart(
 p_business uuid,p_cart uuid,p_label text,p_location uuid,p_customer uuid,
 p_basket jsonb,p_price_mode text,p_discount numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;v_role public.member_role;v_item jsonb;v_qty numeric;v_product uuid;
BEGIN
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR v_role NOT IN ('owner','manager','sales') THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 IF p_cart IS NULL OR length(btrim(coalesce(p_label,''))) NOT BETWEEN 2 AND 80 OR
  p_price_mode NOT IN ('exclusive','inclusive') OR p_discount IS NULL OR
  p_discount<0 OR p_discount>999999999 OR round(p_discount,2)<>p_discount OR
  jsonb_typeof(p_basket)<>'array' OR jsonb_array_length(p_basket) NOT BETWEEN 1 AND 30 THEN
  RAISE EXCEPTION 'Invalid cart'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_stock_locations
  WHERE id=p_location AND business_id=p_business AND active) THEN RAISE EXCEPTION 'Invalid stock location'; END IF;
 IF v_role='sales' AND EXISTS(SELECT 1 FROM public.business_stock_locations
  WHERE id=p_location AND business_id=p_business AND branch_id IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.business_branch_members m WHERE m.branch_id=business_stock_locations.branch_id
    AND m.business_id=p_business AND m.user_id=auth.uid())) THEN
   RAISE EXCEPTION 'Cashier not assigned to this branch' USING ERRCODE='42501'; END IF;
 IF p_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_customers
  WHERE business_id=p_business AND customer_id=p_customer) THEN RAISE EXCEPTION 'Invalid customer'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_basket)) <>
    (SELECT count(DISTINCT (value->>'product_id')) FROM jsonb_array_elements(p_basket)) THEN
  RAISE EXCEPTION 'Duplicate cart product'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_basket) LOOP
  IF jsonb_typeof(v_item->'product_id')<>'string' OR jsonb_typeof(v_item->'quantity')<>'number' THEN
   RAISE EXCEPTION 'Invalid cart item'; END IF;
  v_product:=(v_item->>'product_id')::uuid;
  v_qty:=(v_item->>'quantity')::numeric;
  IF v_qty IS NULL OR v_qty<=0 OR v_qty>1000000 OR round(v_qty,3)<>v_qty OR
   NOT EXISTS(SELECT 1 FROM public.products WHERE id=v_product AND business_id=p_business AND active) THEN
   RAISE EXCEPTION 'Invalid cart quantity or product'; END IF;
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('pos-carts:'||p_business::text||':'||auth.uid()::text,0));
 IF EXISTS(SELECT 1 FROM public.business_pos_held_carts WHERE id=p_cart AND
  (business_id<>p_business OR cashier_id<>auth.uid())) THEN RAISE EXCEPTION 'Held cart belongs to another cashier' USING ERRCODE='42501'; END IF;
 -- Prevent unauthorised carts from being inserted via user-controlled IDs.
 IF NOT EXISTS(SELECT 1 FROM public.business_pos_held_carts WHERE id=p_cart) THEN
  IF (SELECT count(*) FROM public.business_pos_held_carts WHERE business_id=p_business AND cashier_id=auth.uid())>=20 THEN
   RAISE EXCEPTION 'Maximum 20 held carts per cashier'; END IF;
 END IF;
 INSERT INTO public.business_pos_held_carts(id,business_id,cashier_id,label,location_id,customer_id,basket,price_mode,discount)
 VALUES(p_cart,p_business,auth.uid(),btrim(p_label),p_location,p_customer,p_basket,p_price_mode,p_discount)
 ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label,location_id=EXCLUDED.location_id,
  customer_id=EXCLUDED.customer_id,basket=EXCLUDED.basket,price_mode=EXCLUDED.price_mode,
  discount=EXCLUDED.discount,updated_at=now()
 WHERE public.business_pos_held_carts.business_id=EXCLUDED.business_id
   AND public.business_pos_held_carts.cashier_id=EXCLUDED.cashier_id
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN
  RAISE EXCEPTION 'Held cart belongs to another cashier' USING ERRCODE='42501';
 END IF;
 RETURN v_id;
END;$$;

CREATE FUNCTION public.business_delete_pos_cart(p_business uuid,p_cart uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 DELETE FROM public.business_pos_held_carts WHERE id=p_cart AND business_id=p_business AND cashier_id=auth.uid();
 RETURN FOUND;
END;$$;

-- Store the request signature so a reused checkout token cannot silently return a different sale.
CREATE TABLE public.business_pos_split_checkouts (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
 request_fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,request_id)
);
ALTER TABLE public.business_pos_split_checkouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_pos_split_checkouts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_pos_split_checkouts TO authenticated;
CREATE POLICY pos_split_checkout_read ON public.business_pos_split_checkouts FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'pos'));

CREATE FUNCTION public.business_pos_checkout_split(
 p_business uuid,p_request uuid,p_customer uuid,p_items jsonb,p_tenders jsonb,
 p_price_mode text,p_discount numeric,p_location uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role public.member_role;v_order uuid;v_total numeric(14,2);v_paid numeric(14,2):=0;
 v_reviewed boolean;v_registered boolean;
 v_tender jsonb;v_method text;v_amount numeric;v_reference text;
 v_fingerprint text;v_existing record;v_count integer;
BEGIN
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR v_role NOT IN ('owner','manager','sales') OR NOT public.business_has_feature(p_business,'pos') THEN
  RAISE EXCEPTION 'POS access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business AND currency='NGN') THEN
  RAISE EXCEPTION 'Split POS recording currently supports NGN businesses only'; END IF;
 IF p_request IS NULL OR jsonb_typeof(p_tenders)<>'array' OR jsonb_array_length(p_tenders) NOT BETWEEN 2 AND 3 OR
  jsonb_typeof(p_items)<>'array' OR p_location IS NULL OR p_price_mode NOT IN ('inclusive','exclusive') OR
  p_discount IS NULL OR p_discount<0 OR round(p_discount,2)<>p_discount THEN
  RAISE EXCEPTION 'Invalid split checkout'; END IF;
 v_fingerprint:=md5(coalesce(p_business::text,'')||'|'||coalesce(p_customer::text,'')||'|'||
  p_items::text||'|'||p_tenders::text||'|'||p_price_mode||'|'||p_discount::text||'|'||p_location::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_business::text||':'||p_request::text,0));
 SELECT order_id,request_fingerprint INTO v_existing FROM public.business_pos_split_checkouts
  WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF v_existing.request_fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'Checkout key already used with other details'; END IF;
  RETURN v_existing.order_id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.business_pos_sales WHERE business_id=p_business AND request_id=p_request) THEN
  RAISE EXCEPTION 'Checkout key belongs to a different sale'; END IF;
 FOR v_tender IN SELECT value FROM jsonb_array_elements(p_tenders) LOOP
  IF jsonb_typeof(v_tender->'amount')<>'number' OR jsonb_typeof(v_tender->'method')<>'string' THEN
   RAISE EXCEPTION 'Invalid tender format'; END IF;
  v_method:=v_tender->>'method';v_amount:=(v_tender->>'amount')::numeric;
  v_reference:=coalesce(v_tender->>'reference','');
  IF v_method NOT IN ('cash','transfer','pos','card','other') OR v_amount IS NULL OR v_amount<=0 OR
   v_amount>999999999 OR round(v_amount,2)<>v_amount OR length(v_reference)>150 THEN
   RAISE EXCEPTION 'Invalid tender method, amount or reference'; END IF;
  v_paid:=v_paid+v_amount;
 END LOOP;
 -- The existing branch-aware RPC verifies tax, approved rules, stock, location and role.
 -- It creates an UNPAID sale first; all payments below happen inside the same transaction.
 SELECT EXISTS(SELECT 1 FROM public.business_tax_profiles WHERE business_id=p_business
  AND vat_registration_status='registered') INTO v_registered;
 SELECT EXISTS(SELECT 1 FROM public.business_tax_profiles WHERE business_id=p_business
  AND vat_registration_status='registered' AND classification_status='reviewed') INTO v_reviewed;
 IF v_registered AND NOT v_reviewed THEN RAISE EXCEPTION 'Registered VAT business requires tax review before sale'; END IF;
 IF NOT v_reviewed AND (p_price_mode<>'exclusive' OR p_discount<>0) THEN
  RAISE EXCEPTION 'Pricing options require a reviewed VAT profile'; END IF;
 v_order:=public.business_pos_checkout_at_location(p_business,p_request,p_customer,p_items,false,'other',NULL,
  CASE WHEN v_reviewed THEN p_price_mode ELSE NULL END,p_discount,p_location);
 SELECT total INTO v_total FROM public.orders WHERE id=v_order AND business_id=p_business FOR UPDATE;
 IF v_total IS NULL OR v_paid>v_total THEN RAISE EXCEPTION 'Recorded tenders exceed the verified order total'; END IF;
 FOR v_tender IN SELECT value FROM jsonb_array_elements(p_tenders) LOOP
  PERFORM public.crm_record_payment(p_business,v_order,(v_tender->>'amount')::numeric,
   (v_tender->>'method')::public.payment_method,nullif(btrim(coalesce(v_tender->>'reference','')),''));
 END LOOP;
 UPDATE public.business_pos_sales SET payment_recorded=true WHERE order_id=v_order AND business_id=p_business;
 IF v_paid=v_total THEN
  UPDATE public.orders SET status='completed'::public.order_status,updated_at=now() WHERE id=v_order AND business_id=p_business;
 END IF;
 INSERT INTO public.business_pos_split_checkouts(business_id,request_id,order_id,request_fingerprint)
 VALUES(p_business,p_request,v_order,v_fingerprint);
 RETURN v_order;
END;$$;

-- Close an older direct-RPC loophole: all NEW registered-VAT POS sale records must
-- carry reviewed item evidence before any payment or shift is attributed. Legacy
-- records remain unchanged. This applies to both single and split checkout RPCs.
CREATE FUNCTION public.business_guard_registered_pos_vat() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_items integer;v_lines integer;v_vat numeric;v_order_vat numeric;
BEGIN
 IF EXISTS(SELECT 1 FROM public.business_tax_profiles
   WHERE business_id=NEW.business_id AND vat_registration_status='registered') THEN
  IF NOT EXISTS(SELECT 1 FROM public.business_tax_profiles
   WHERE business_id=NEW.business_id AND vat_registration_status='registered'
   AND classification_status='reviewed') THEN
   RAISE EXCEPTION 'Registered VAT business requires reviewed tax profile before POS sale'; END IF;
  SELECT count(*) INTO v_items FROM public.order_items WHERE order_id=NEW.order_id;
  SELECT count(*),coalesce(sum(vat_amount),0) INTO v_lines,v_vat
   FROM public.business_pos_tax_lines WHERE business_id=NEW.business_id AND order_id=NEW.order_id;
  SELECT tax INTO v_order_vat FROM public.orders WHERE business_id=NEW.business_id AND id=NEW.order_id;
  IF v_items=0 OR v_lines<>v_items OR round(v_vat,2) IS DISTINCT FROM round(v_order_vat,2) THEN
   RAISE EXCEPTION 'POS sale requires complete approved VAT evidence'; END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.business_guard_registered_pos_vat() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER pos_vat_guard_before_sale BEFORE INSERT ON public.business_pos_sales
 FOR EACH ROW EXECUTE FUNCTION public.business_guard_registered_pos_vat();

REVOKE ALL ON FUNCTION public.business_save_pos_cart(uuid,uuid,text,uuid,uuid,jsonb,text,numeric),
 public.business_delete_pos_cart(uuid,uuid),
 public.business_pos_checkout_split(uuid,uuid,uuid,jsonb,jsonb,text,numeric,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.business_save_pos_cart(uuid,uuid,text,uuid,uuid,jsonb,text,numeric),
 public.business_delete_pos_cart(uuid,uuid),
 public.business_pos_checkout_split(uuid,uuid,uuid,jsonb,jsonb,text,numeric,uuid) TO authenticated;
COMMIT;
