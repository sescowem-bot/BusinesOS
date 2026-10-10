-- BusinessOS Phase 030K-B: auditable branch stock; apply once after 038 in staging.
-- Historical products are attributed to a labelled UNALLOCATED holding location, not guessed branch allocations.
-- Site-wide products.stock_quantity stays the canonical total; this ledger reconciles to it.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_purchase_receipts') IS NULL OR to_regclass('public.business_branches') IS NULL
 OR to_regclass('public.business_pos_sales') IS NULL OR to_regclass('public.inventory_stock_counts') IS NULL THEN
  RAISE EXCEPTION 'Install prerequisites through migration 038 first';
 END IF;
 IF to_regclass('public.business_stock_locations') IS NOT NULL THEN
  RAISE EXCEPTION 'Migration 039 already appears installed; inspect before rerunning';
 END IF;
END $$;

CREATE TABLE public.business_stock_locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 branch_id uuid,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 120),
 is_unallocated boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,business_id), UNIQUE(business_id,branch_id),
 FOREIGN KEY(branch_id,business_id) REFERENCES public.business_branches(id,business_id),
 CHECK ((is_unallocated AND branch_id IS NULL) OR (NOT is_unallocated AND branch_id IS NOT NULL))
);
CREATE UNIQUE INDEX business_one_unallocated_location ON public.business_stock_locations(business_id) WHERE is_unallocated;
CREATE INDEX business_stock_locations_list ON public.business_stock_locations(business_id,active,name);
CREATE TABLE public.business_location_balances (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 location_id uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK(quantity>=0 AND quantity<=99999999999),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,location_id,product_id),
 FOREIGN KEY(location_id,business_id) REFERENCES public.business_stock_locations(id,business_id)
);
CREATE INDEX business_location_balances_product ON public.business_location_balances(business_id,product_id);
CREATE TABLE public.business_location_stock_transfers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 from_location_id uuid NOT NULL,
 to_location_id uuid NOT NULL,
 quantity numeric(14,3) NOT NULL CHECK(quantity>0),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),
 transferred_by uuid NOT NULL REFERENCES auth.users(id),
 transferred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,request_id),
 FOREIGN KEY(from_location_id,business_id) REFERENCES public.business_stock_locations(id,business_id),
 FOREIGN KEY(to_location_id,business_id) REFERENCES public.business_stock_locations(id,business_id),
 CHECK(from_location_id<>to_location_id)
);
CREATE INDEX business_location_transfers_history ON public.business_location_stock_transfers(business_id,transferred_at DESC);
CREATE TABLE public.business_location_stock_counts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 location_id uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 expected_quantity numeric(14,3) NOT NULL CHECK(expected_quantity>=0),
 counted_quantity numeric(14,3) NOT NULL CHECK(counted_quantity>=0),
 variance numeric(14,3) GENERATED ALWAYS AS (counted_quantity-expected_quantity) STORED,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),
 counted_by uuid NOT NULL REFERENCES auth.users(id),
 counted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,request_id),
 FOREIGN KEY(location_id,business_id) REFERENCES public.business_stock_locations(id,business_id)
);
CREATE INDEX business_location_counts_history ON public.business_location_stock_counts(business_id,counted_at DESC);

-- Backfill the existing company-wide stock as UNALLOCATED. No physical branch is guessed.
INSERT INTO public.business_stock_locations(business_id,name,is_unallocated)
 SELECT b.id,'Unallocated / receiving',true FROM public.businesses b;
INSERT INTO public.business_location_balances(business_id,location_id,product_id,quantity)
 SELECT p.business_id,l.id,p.id,p.stock_quantity FROM public.products p
 JOIN public.business_stock_locations l ON l.business_id=p.business_id AND l.is_unallocated
 WHERE p.track_inventory;

-- Service-only and brand-new businesses need a valid checkout location even when no
-- tracked product has yet been created. A new business gets an empty default location.
CREATE FUNCTION public.business_create_default_stock_location() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.business_stock_locations(business_id,name,is_unallocated)
 VALUES(NEW.id,'Unallocated / receiving',true) ON CONFLICT DO NOTHING;
 RETURN NEW;
END;$$;
CREATE TRIGGER business_create_default_stock_location_trigger AFTER INSERT ON public.businesses
 FOR EACH ROW EXECUTE FUNCTION public.business_create_default_stock_location();

-- One source of truth: every legacy stock increase/decrease is attributed atomically to
-- an explicit selected location, or UNALLOCATED when a legacy operation has no location context.
-- If that location lacks stock, the original POS/adjustment fails closed, not silently steals
-- quantities from a different branch. Do not allocate stock until branch checkout is deployed.
CREATE FUNCTION public.business_sync_location_balance() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_delta numeric(14,3); v_location uuid; v_requested text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.track_inventory AND NOT NEW.track_inventory THEN
  IF EXISTS(SELECT 1 FROM public.business_location_balances
   WHERE business_id=NEW.business_id AND product_id=NEW.id AND quantity<>0) THEN
   RAISE EXCEPTION 'Move inventory to zero before disabling tracking';
  END IF;
  DELETE FROM public.business_location_balances WHERE business_id=NEW.business_id AND product_id=NEW.id;
  RETURN NEW;
  END IF;
 END IF;
 IF NOT NEW.track_inventory THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  v_delta:=NEW.stock_quantity;
 ELSIF NOT OLD.track_inventory AND NEW.track_inventory THEN
  v_delta:=NEW.stock_quantity;
 ELSE
  v_delta:=NEW.stock_quantity-OLD.stock_quantity;
 END IF;
 INSERT INTO public.business_stock_locations(business_id,name,is_unallocated)
  VALUES(NEW.business_id,'Unallocated / receiving',true) ON CONFLICT DO NOTHING;
 v_requested:=nullif(current_setting('businessos.stock_location',true),'');
 IF v_requested IS NOT NULL THEN
  v_location:=v_requested::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.business_stock_locations WHERE id=v_location
    AND business_id=NEW.business_id AND active) THEN
   RAISE EXCEPTION 'Requested inventory location is unavailable';
  END IF;
 ELSE
  SELECT id INTO v_location FROM public.business_stock_locations
   WHERE business_id=NEW.business_id AND is_unallocated;
 END IF;
 INSERT INTO public.business_location_balances(business_id,location_id,product_id,quantity)
  VALUES(NEW.business_id,v_location,NEW.id,0) ON CONFLICT DO NOTHING;
 IF v_delta=0 THEN RETURN NEW; END IF;
 UPDATE public.business_location_balances SET quantity=quantity+v_delta,updated_at=now()
 WHERE business_id=NEW.business_id AND location_id=v_location AND product_id=NEW.id
 AND quantity+v_delta BETWEEN 0 AND 99999999999;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Insufficient stock in the selected location. Transfer available stock or select another location.'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER business_sync_location_balance_trigger
 AFTER INSERT OR UPDATE OF stock_quantity,track_inventory ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.business_sync_location_balance();

-- Every new physical location is an explicit branch; only an owner/manager may activate it.
CREATE FUNCTION public.business_enable_branch_stock(p_business uuid,p_branch uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_branch public.business_branches%rowtype;v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'inventory') OR NOT EXISTS
  (SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager')) THEN RAISE EXCEPTION 'Owner/manager inventory access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_branch FROM public.business_branches WHERE id=p_branch AND business_id=p_business AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active branch not found'; END IF;
 INSERT INTO public.business_stock_locations(business_id,branch_id,name)
 VALUES(p_business,p_branch,v_branch.name) ON CONFLICT(business_id,branch_id)
 DO UPDATE SET name=excluded.name,active=true RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

-- Product row is the common lock order used by sales, receipts, counts and transfers.
CREATE FUNCTION public.business_transfer_location_stock(p_business uuid,p_request uuid,p_product uuid,
 p_from uuid,p_to uuid,p_quantity numeric,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_existing public.business_location_stock_transfers%rowtype;v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'inventory') OR NOT EXISTS
  (SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager')) THEN RAISE EXCEPTION 'Owner/manager inventory access required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_product IS NULL OR p_from IS NULL OR p_to IS NULL OR p_from=p_to
 OR p_quantity IS NULL OR p_quantity<=0 OR p_quantity>1000000 OR round(p_quantity,3)<>p_quantity
 OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Invalid stock transfer'; END IF;
 PERFORM 1 FROM public.products WHERE id=p_product AND business_id=p_business AND active AND track_inventory FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tracked product unavailable'; END IF;
 SELECT * INTO v_existing FROM public.business_location_stock_transfers
 WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF v_existing.product_id<>p_product OR v_existing.from_location_id<>p_from OR v_existing.to_location_id<>p_to
   OR v_existing.quantity<>p_quantity OR v_existing.reason<>btrim(p_reason) THEN RAISE EXCEPTION 'Transfer key reused for different details'; END IF;
  RETURN v_existing.id;
 END IF;
 IF (SELECT count(*) FROM public.business_stock_locations WHERE business_id=p_business AND active AND id IN (p_from,p_to))<>2 THEN
  RAISE EXCEPTION 'Transfer locations must belong to this business and be active'; END IF;
 UPDATE public.business_location_balances SET quantity=quantity-p_quantity,updated_at=now()
 WHERE business_id=p_business AND product_id=p_product AND location_id=p_from AND quantity>=p_quantity;
 IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock at source location'; END IF;
 INSERT INTO public.business_location_balances(business_id,location_id,product_id,quantity)
 VALUES(p_business,p_to,p_product,0) ON CONFLICT DO NOTHING;
 UPDATE public.business_location_balances SET quantity=quantity+p_quantity,updated_at=now()
 WHERE business_id=p_business AND product_id=p_product AND location_id=p_to
 AND quantity+p_quantity<=99999999999;
 IF NOT FOUND THEN RAISE EXCEPTION 'Destination location balance limit exceeded'; END IF;
 INSERT INTO public.business_location_stock_transfers(business_id,request_id,product_id,from_location_id,to_location_id,quantity,reason,transferred_by)
 VALUES(p_business,p_request,p_product,p_from,p_to,p_quantity,btrim(p_reason),auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

CREATE FUNCTION public.business_count_location_stock(p_business uuid,p_request uuid,p_location uuid,p_product uuid,
 p_expected numeric,p_counted numeric,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_balance numeric;v_total numeric;v_id uuid;v_old public.business_location_stock_counts%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'inventory') OR NOT EXISTS
  (SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager','inventory')) THEN RAISE EXCEPTION 'Inventory role required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_location IS NULL OR p_product IS NULL OR p_expected IS NULL OR p_counted IS NULL
 OR p_expected<0 OR p_counted<0 OR p_counted>99999999999 OR round(p_expected,3)<>p_expected
 OR round(p_counted,3)<>p_counted OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Invalid location stock count'; END IF;
 SELECT stock_quantity INTO v_total FROM public.products WHERE id=p_product AND business_id=p_business
 AND active AND track_inventory FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tracked product unavailable'; END IF;
 SELECT * INTO v_old FROM public.business_location_stock_counts WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF v_old.location_id<>p_location OR v_old.product_id<>p_product OR v_old.expected_quantity<>p_expected
   OR v_old.counted_quantity<>p_counted THEN RAISE EXCEPTION 'Count key reused for different details'; END IF;
  RETURN v_old.id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_stock_locations WHERE id=p_location AND business_id=p_business AND active) THEN
  RAISE EXCEPTION 'Location unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=p_business AND m.user_id=auth.uid() AND m.role='inventory')
  AND EXISTS(SELECT 1 FROM public.business_stock_locations l WHERE l.id=p_location AND l.branch_id IS NOT NULL)
  AND NOT EXISTS(SELECT 1 FROM public.business_stock_locations l JOIN public.business_branch_members bm
    ON bm.business_id=l.business_id AND bm.branch_id=l.branch_id AND bm.user_id=auth.uid()
    WHERE l.id=p_location) THEN RAISE EXCEPTION 'Inventory staff not assigned to selected branch' USING ERRCODE='42501'; END IF;
 SELECT quantity INTO v_balance FROM public.business_location_balances
 WHERE business_id=p_business AND location_id=p_location AND product_id=p_product;
 v_balance:=coalesce(v_balance,0);
 IF v_balance<>p_expected THEN RAISE EXCEPTION 'Location stock changed. Reload and recount.' USING ERRCODE='40001'; END IF;
 IF v_total+p_counted-p_expected NOT BETWEEN 0 AND 99999999999 THEN
  RAISE EXCEPTION 'Resulting company-wide stock out of range'; END IF;
 IF p_counted<>p_expected THEN
  PERFORM set_config('businessos.stock_location',p_location::text,true);
  UPDATE public.products SET stock_quantity=v_total+p_counted-p_expected,updated_at=now()
   WHERE id=p_product AND business_id=p_business;
  PERFORM set_config('businessos.stock_location','',true);
  INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,notes)
  VALUES(p_business,p_product,'adjustment',p_counted-p_expected,'Location stock count: '||btrim(p_reason));
 END IF;
 INSERT INTO public.business_location_stock_counts(business_id,request_id,location_id,product_id,expected_quantity,counted_quantity,reason,counted_by)
 VALUES(p_business,p_request,p_location,p_product,p_expected,p_counted,btrim(p_reason),auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

-- Reject old aggregate stock-count UI once the product has distributed location stock.
-- The legacy function calls INSERT on inventory_stock_counts after updating products, so
-- this failure rolls back the entire legacy count and avoids a misleading branch variance.
CREATE FUNCTION public.business_guard_legacy_aggregate_stock_count() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.business_location_balances bl JOIN public.business_stock_locations l
   ON l.id=bl.location_id AND l.business_id=bl.business_id
   WHERE bl.business_id=NEW.business_id AND bl.product_id=NEW.product_id
   AND l.branch_id IS NOT NULL AND bl.quantity>0) THEN
  RAISE EXCEPTION 'Location balances exist. Use location-specific stock counts instead.';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER guard_legacy_stock_count BEFORE INSERT ON public.inventory_stock_counts
 FOR EACH ROW EXECUTE FUNCTION public.business_guard_legacy_aggregate_stock_count();

-- Legacy goods receipts and refunds go to UNALLOCATED unless explicitly reallocated.
-- This avoids pretending they were physically received by a particular branch.
ALTER TABLE public.business_pos_sales ADD COLUMN location_id uuid;
ALTER TABLE public.business_pos_sales ADD CONSTRAINT business_pos_sales_stock_location_fkey
 FOREIGN KEY(location_id,business_id) REFERENCES public.business_stock_locations(id,business_id);
CREATE INDEX business_pos_sales_by_location ON public.business_pos_sales(business_id,location_id,created_at DESC);
CREATE FUNCTION public.business_pos_checkout_at_location(
 p_business uuid,p_request uuid,p_customer uuid,p_items jsonb,p_paid boolean,
 p_method public.payment_method,p_reference text,p_price_mode text,p_discount numeric,p_location uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_location public.business_stock_locations%rowtype;v_role public.member_role;v_order uuid;v_existing record;
BEGIN
 SELECT role INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR v_role NOT IN ('owner','manager','sales') THEN
  RAISE EXCEPTION 'POS access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_location FROM public.business_stock_locations WHERE id=p_location AND business_id=p_business AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active stock location'; END IF;
 IF v_role='sales' AND v_location.branch_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.business_branch_members WHERE business_id=p_business
   AND branch_id=v_location.branch_id AND user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Cashier not assigned to selected branch' USING ERRCODE='42501'; END IF;
 SELECT order_id,location_id INTO v_existing FROM public.business_pos_sales
 WHERE business_id=p_business AND request_id=p_request;
 IF FOUND THEN
  IF v_existing.location_id IS DISTINCT FROM p_location THEN RAISE EXCEPTION 'Checkout key already used for a different location'; END IF;
  RETURN v_existing.order_id;
 END IF;
 PERFORM set_config('businessos.stock_location',p_location::text,true);
 IF p_price_mode IS NULL THEN
  IF coalesce(p_discount,0)<>0 THEN RAISE EXCEPTION 'Discount requires approved VAT checkout'; END IF;
  v_order:=public.business_pos_checkout(p_business,p_request,p_customer,p_items,p_paid,p_method,p_reference);
 ELSE
  v_order:=public.business_pos_checkout_priced(p_business,p_request,p_customer,p_items,p_paid,p_method,p_reference,p_price_mode,p_discount);
 END IF;
 PERFORM set_config('businessos.stock_location','',true);
 UPDATE public.business_pos_sales SET location_id=p_location WHERE business_id=p_business AND order_id=v_order
 AND location_id IS NULL;
 IF NOT FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.business_pos_sales WHERE business_id=p_business AND order_id=v_order AND location_id=p_location) THEN
   RAISE EXCEPTION 'POS location could not be attributed'; END IF;
 END IF;
 RETURN v_order;
END;$$;

-- Prevent direct mutation of balances/transfer/count audit records from the browser.
ALTER TABLE public.business_stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_location_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_location_stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_location_stock_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_stock_locations,public.business_location_balances,
 public.business_location_stock_transfers,public.business_location_stock_counts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_stock_locations,public.business_location_balances,
 public.business_location_stock_transfers,public.business_location_stock_counts TO authenticated;
CREATE POLICY stock_locations_read ON public.business_stock_locations FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'inventory') OR public.business_has_feature(business_id,'pos'));
CREATE POLICY stock_balances_read ON public.business_location_balances FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'inventory') OR public.business_has_feature(business_id,'pos'));
CREATE POLICY stock_transfers_read ON public.business_location_stock_transfers FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'inventory'));
CREATE POLICY stock_counts_read ON public.business_location_stock_counts FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'inventory'));

REVOKE ALL ON FUNCTION public.business_sync_location_balance(),public.business_create_default_stock_location(),public.business_guard_legacy_aggregate_stock_count() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.business_enable_branch_stock(uuid,uuid),
 public.business_transfer_location_stock(uuid,uuid,uuid,uuid,uuid,numeric,text),
 public.business_count_location_stock(uuid,uuid,uuid,uuid,numeric,numeric,text),
 public.business_pos_checkout_at_location(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text,text,numeric,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.business_enable_branch_stock(uuid,uuid),
 public.business_transfer_location_stock(uuid,uuid,uuid,uuid,uuid,numeric,text),
 public.business_count_location_stock(uuid,uuid,uuid,uuid,numeric,numeric,text),
 public.business_pos_checkout_at_location(uuid,uuid,uuid,jsonb,boolean,public.payment_method,text,text,numeric,uuid) TO authenticated;
COMMIT;
