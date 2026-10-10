-- Phase 027 | Guarded inventory counts and role-consistent stock adjustments.
-- Apply ONCE after migration 026. Requires migration 023 plan-role entitlements.
-- No existing stock levels are modified by installation.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.products') IS NULL
 OR to_regclass('public.inventory_movements') IS NULL
 OR to_regclass('public.platform_plan_role_features') IS NULL
 OR to_regprocedure('public.business_has_feature(uuid,text)') IS NULL THEN
  RAISE EXCEPTION 'Missing prerequisites: migrations 007 and 023 must be installed';
 END IF;
 IF to_regclass('public.inventory_stock_counts') IS NOT NULL THEN
  RAISE EXCEPTION 'inventory_stock_counts already exists. Inspect partial migration before rerunning';
 END IF;
END $$;

CREATE TABLE public.inventory_stock_counts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 expected_quantity numeric(14,3) NOT NULL CHECK(expected_quantity>=0),
 counted_quantity numeric(14,3) NOT NULL CHECK(counted_quantity>=0),
 variance numeric(14,3) GENERATED ALWAYS AS (counted_quantity-expected_quantity) STORED,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),
 counted_by uuid NOT NULL REFERENCES auth.users(id),
 counted_at timestamptz NOT NULL DEFAULT now(),
 movement_id uuid REFERENCES public.inventory_movements(id)
);
CREATE INDEX inventory_stock_counts_business_date ON public.inventory_stock_counts(business_id,counted_at DESC);
ALTER TABLE public.inventory_stock_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_stock_counts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.inventory_stock_counts TO authenticated;
CREATE POLICY inventory_stock_counts_access ON public.inventory_stock_counts
 FOR SELECT TO authenticated
 USING(public.business_has_feature(business_id,'inventory'));

-- Existing adjustments previously supported only the owner, even when the configured
-- business plan explicitly assigned inventory access to manager/inventory roles.
CREATE OR REPLACE FUNCTION public.inventory_adjust_stock(
 p_business uuid,p_item uuid,p_delta numeric,p_reason text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_stock numeric; v_track boolean;
BEGIN
 SELECT role::text INTO v_role FROM public.business_members
 WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL OR v_role NOT IN ('owner','manager','inventory')
 OR NOT public.business_has_feature(p_business,'inventory') THEN
  RAISE EXCEPTION 'Inventory permission required' USING ERRCODE='42501'; END IF;
 IF p_delta IS NULL OR p_delta=0 OR abs(p_delta)>100000000
 OR round(p_delta,3)<>p_delta
 OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN
  RAISE EXCEPTION 'Invalid quantity or reason'; END IF;
 SELECT stock_quantity,track_inventory INTO v_stock,v_track
 FROM public.products WHERE id=p_item AND business_id=p_business AND active FOR UPDATE;
 IF NOT FOUND OR NOT v_track THEN RAISE EXCEPTION 'Active tracked product not found'; END IF;
 IF v_stock+p_delta<0 OR v_stock+p_delta>99999999999 THEN
  RAISE EXCEPTION 'Resulting stock is out of range'; END IF;
 UPDATE public.products SET stock_quantity=v_stock+p_delta,updated_at=now()
 WHERE id=p_item AND business_id=p_business;
 INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,notes)
 VALUES(p_business,p_item,'adjustment',p_delta,btrim(p_reason));
 RETURN v_stock+p_delta;
END;$$;
REVOKE ALL ON FUNCTION public.inventory_adjust_stock(uuid,uuid,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_adjust_stock(uuid,uuid,numeric,text) TO authenticated;

-- Count matching the expected balance prevents a stale browser tab from overwriting
-- stock changed by another user. Count + stock update + movement are atomic.
CREATE FUNCTION public.inventory_record_stock_count(
 p_business uuid,p_item uuid,p_expected numeric,p_counted numeric,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_actual numeric; v_track boolean; v_delta numeric;
        v_id uuid; v_movement uuid;
BEGIN
 SELECT role::text INTO v_role FROM public.business_members
 WHERE business_id=p_business AND user_id=auth.uid();
 IF v_role IS NULL OR v_role NOT IN ('owner','manager','inventory')
 OR NOT public.business_has_feature(p_business,'inventory') THEN
  RAISE EXCEPTION 'Inventory permission required' USING ERRCODE='42501'; END IF;
 IF p_expected IS NULL OR p_counted IS NULL OR p_expected<0 OR p_counted<0
 OR p_counted>99999999999 OR p_expected>99999999999
 OR round(p_expected,3)<>p_expected OR round(p_counted,3)<>p_counted
 OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Invalid stock count'; END IF;
 SELECT stock_quantity,track_inventory INTO v_actual,v_track
 FROM public.products WHERE id=p_item AND business_id=p_business AND active FOR UPDATE;
 IF NOT FOUND OR NOT v_track THEN RAISE EXCEPTION 'Active tracked product not found'; END IF;
 IF v_actual IS DISTINCT FROM p_expected THEN
  RAISE EXCEPTION 'Stock changed since page loaded. Reload inventory and recount before saving.' USING ERRCODE='40001';
 END IF;
 v_delta:=p_counted-v_actual;
 IF v_delta<>0 THEN
  UPDATE public.products SET stock_quantity=p_counted,updated_at=now()
  WHERE business_id=p_business AND id=p_item;
  INSERT INTO public.inventory_movements(business_id,product_id,movement_type,quantity,notes)
  VALUES(p_business,p_item,'adjustment',v_delta,'Stock count: '||btrim(p_reason))
  RETURNING id INTO v_movement;
 END IF;
 INSERT INTO public.inventory_stock_counts(
  business_id,product_id,expected_quantity,counted_quantity,reason,counted_by,movement_id)
 VALUES(p_business,p_item,p_expected,p_counted,btrim(p_reason),auth.uid(),v_movement)
 RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.inventory_record_stock_count(uuid,uuid,numeric,numeric,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_record_stock_count(uuid,uuid,numeric,numeric,text)
 TO authenticated;
COMMIT;
