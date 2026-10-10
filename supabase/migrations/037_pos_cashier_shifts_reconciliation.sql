-- BusinessOS Phase 030J | Cashier shifts and cash reconciliation.
-- Run ONCE in staging after migration 036. No cash is transferred, no journals are posted.
-- Shift receipts are immutable capture snapshots. Recorded cash refunds require an explicit
-- cash-out movement; other payment methods are NOT counted as physical cash.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.business_pos_sales') IS NULL OR
    to_regclass('public.business_pos_refunds') IS NULL OR
    to_regclass('public.business_pos_returns') IS NULL OR
    to_regclass('public.payments') IS NULL OR
    to_regclass('public.business_feature_grants') IS NULL THEN
  RAISE EXCEPTION 'Install all required POS migrations through 036 first';
 END IF;
 IF to_regclass('public.business_pos_cashier_shifts') IS NOT NULL THEN
  RAISE EXCEPTION 'Phase 037 appears installed or partially installed; inspect before rerunning';
 END IF;
END $$;

CREATE TABLE public.business_pos_cashier_shifts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 cashier_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','reviewed','flagged')),
 opened_at timestamptz NOT NULL DEFAULT now(),
 opening_cash numeric(14,2) NOT NULL CHECK(opening_cash>=0 AND opening_cash<=999999999999.99),
 closed_at timestamptz, counted_cash numeric(14,2) CHECK(counted_cash>=0),
 sales_cash_total numeric(14,2), cash_in_total numeric(14,2), cash_out_total numeric(14,2),
 expected_cash numeric(14,2), variance numeric(14,2),
 close_note text CHECK(length(close_note)<=500),
 reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz,
 review_note text CHECK(length(review_note)<=500),
 UNIQUE(id,business_id)
);
CREATE UNIQUE INDEX cashier_one_active_shift ON public.business_pos_cashier_shifts(business_id,cashier_id) WHERE status='open';
CREATE INDEX cashier_shift_recent ON public.business_pos_cashier_shifts(business_id,opened_at DESC);

CREATE TABLE public.business_pos_shift_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 shift_id uuid NOT NULL,
 payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 captured_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(shift_id,business_id) REFERENCES public.business_pos_cashier_shifts(id,business_id) ON DELETE RESTRICT
);
CREATE INDEX cashier_receipts_shift ON public.business_pos_shift_receipts(shift_id);

CREATE TABLE public.business_pos_cash_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 shift_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('cash_in','cash_out')),
 amount numeric(14,2) NOT NULL CHECK(amount>0 AND amount<=999999999999.99),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 500),
 reference text NOT NULL CHECK(length(btrim(reference)) BETWEEN 3 AND 150),
 recorded_by uuid NOT NULL REFERENCES auth.users(id),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(shift_id,kind,reference),
 FOREIGN KEY(shift_id,business_id) REFERENCES public.business_pos_cashier_shifts(id,business_id) ON DELETE RESTRICT
);
CREATE INDEX cashier_movements_shift ON public.business_pos_cash_movements(shift_id,recorded_at);

ALTER TABLE public.business_pos_sales ADD COLUMN shift_id uuid;
ALTER TABLE public.business_pos_sales ADD CONSTRAINT business_pos_sales_shift_business_fk
 FOREIGN KEY(shift_id,business_id) REFERENCES public.business_pos_cashier_shifts(id,business_id);
CREATE INDEX pos_sales_shift_lookup ON public.business_pos_sales(shift_id) WHERE shift_id IS NOT NULL;

-- All three tables are readable only by their own cashier or a business owner/manager.
-- RPCs are the only available write path for app users.
ALTER TABLE public.business_pos_cashier_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_pos_shift_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_pos_cash_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_pos_cashier_shifts,public.business_pos_shift_receipts,public.business_pos_cash_movements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_pos_cashier_shifts,public.business_pos_shift_receipts,public.business_pos_cash_movements TO authenticated;
CREATE POLICY cashier_shift_read ON public.business_pos_cashier_shifts FOR SELECT TO authenticated USING(
 public.business_has_feature(business_id,'pos') AND
 (cashier_id=auth.uid() OR EXISTS(SELECT 1 FROM public.business_members
  WHERE business_id=business_pos_cashier_shifts.business_id AND user_id=auth.uid() AND role IN ('owner','manager')))
);
CREATE POLICY cashier_receipt_read ON public.business_pos_shift_receipts FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.business_pos_cashier_shifts s WHERE s.id=shift_id AND s.business_id=business_pos_shift_receipts.business_id)
);
CREATE POLICY cashier_movement_read ON public.business_pos_cash_movements FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.business_pos_cashier_shifts s WHERE s.id=shift_id AND s.business_id=business_pos_cash_movements.business_id)
);

CREATE FUNCTION public.business_open_pos_shift(p_business uuid,p_opening numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager','sales')) THEN
  RAISE EXCEPTION 'Cashier permission required' USING ERRCODE='42501'; END IF;
 IF p_opening IS NULL OR p_opening<0 OR p_opening>999999999999.99 OR round(p_opening,2)<>p_opening THEN
  RAISE EXCEPTION 'Invalid opening cash amount'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business AND currency='NGN') THEN
  RAISE EXCEPTION 'This cashier reconciliation currently supports NGN businesses only'; END IF;
 INSERT INTO public.business_pos_cashier_shifts(business_id,cashier_id,opening_cash)
 VALUES(p_business,auth.uid(),p_opening) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.business_open_pos_shift(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_open_pos_shift(uuid,numeric) TO authenticated;

-- Bind new POS sales to an OPEN till for the actor. Older sales are not backfilled.
CREATE FUNCTION public.pos_attach_active_shift() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 SELECT id INTO NEW.shift_id FROM public.business_pos_cashier_shifts
 WHERE business_id=NEW.business_id AND cashier_id=NEW.cashier_id AND status='open'
 ORDER BY opened_at DESC LIMIT 1 FOR UPDATE;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pos_attach_active_shift() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER pos_shift_attach BEFORE INSERT ON public.business_pos_sales
 FOR EACH ROW EXECUTE FUNCTION public.pos_attach_active_shift();

-- Cash collected at POS creation comes BEFORE the POS sale row.
-- Later cash payments are captured by the separate payments trigger below.
CREATE FUNCTION public.pos_attach_checkout_cash() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.shift_id IS NOT NULL THEN
  INSERT INTO public.business_pos_shift_receipts(business_id,shift_id,payment_id,amount)
  SELECT NEW.business_id,NEW.shift_id,p.id,p.amount FROM public.payments p
  JOIN public.business_pos_cashier_shifts s ON s.id=NEW.shift_id
  WHERE p.business_id=NEW.business_id AND p.order_id=NEW.order_id
    AND p.method='cash' AND p.status='completed' AND p.created_at>=s.opened_at
  ON CONFLICT(payment_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pos_attach_checkout_cash() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER pos_shift_capture_checkout AFTER INSERT ON public.business_pos_sales
 FOR EACH ROW EXECUTE FUNCTION public.pos_attach_checkout_cash();

CREATE FUNCTION public.pos_capture_later_cash() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_shift uuid;
BEGIN
 IF NEW.method<>'cash' OR NEW.status<>'completed' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status='completed' THEN RETURN NEW; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.business_pos_sales
    WHERE business_id=NEW.business_id AND order_id=NEW.order_id) THEN RETURN NEW; END IF;
 SELECT id INTO v_shift FROM public.business_pos_cashier_shifts
 WHERE business_id=NEW.business_id AND cashier_id=auth.uid() AND status='open'
 ORDER BY opened_at DESC LIMIT 1 FOR UPDATE;
 IF v_shift IS NOT NULL THEN
  INSERT INTO public.business_pos_shift_receipts(business_id,shift_id,payment_id,amount)
  VALUES(NEW.business_id,v_shift,NEW.id,NEW.amount)
  ON CONFLICT(payment_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pos_capture_later_cash() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER pos_shift_capture_cash_payment AFTER INSERT OR UPDATE OF status ON public.payments
 FOR EACH ROW EXECUTE FUNCTION public.pos_capture_later_cash();

CREATE FUNCTION public.business_add_pos_cash_movement(
 p_business uuid,p_shift uuid,p_kind text,p_amount numeric,p_reason text,p_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR NOT EXISTS(
  SELECT 1 FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid()
   AND role IN ('owner','manager','sales')) THEN
  RAISE EXCEPTION 'Cashier permission required' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN ('cash_in','cash_out') OR p_amount IS NULL OR p_amount<=0 OR
    p_amount>999999999999.99 OR round(p_amount,2)<>p_amount OR
    length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500 OR
    length(btrim(coalesce(p_reference,''))) NOT BETWEEN 3 AND 150 THEN
  RAISE EXCEPTION 'A valid cash movement, explanation and unique reference are required'; END IF;
 PERFORM 1 FROM public.business_pos_cashier_shifts WHERE id=p_shift AND business_id=p_business
  AND cashier_id=auth.uid() AND status='open' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only the cashier may record movements on their open shift'; END IF;
 INSERT INTO public.business_pos_cash_movements(business_id,shift_id,kind,amount,reason,reference,recorded_by)
 VALUES(p_business,p_shift,p_kind,p_amount,btrim(p_reason),btrim(p_reference),auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.business_add_pos_cash_movement(uuid,uuid,text,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_add_pos_cash_movement(uuid,uuid,text,numeric,text,text) TO authenticated;

CREATE FUNCTION public.business_pos_shift_totals(p_business uuid,p_shift uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_s record;v_receipts numeric(14,2);v_in numeric(14,2);v_out numeric(14,2);
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.business_pos_shift_totals(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_pos_shift_totals(uuid,uuid) TO authenticated;

CREATE FUNCTION public.business_close_pos_shift(p_business uuid,p_shift uuid,p_counted numeric,p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_shift record;v_receipts numeric(14,2);v_in numeric(14,2);v_out numeric(14,2);v_expected numeric(14,2);
BEGIN
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') THEN
  RAISE EXCEPTION 'POS permission required' USING ERRCODE='42501'; END IF;
 IF p_counted IS NULL OR p_counted<0 OR p_counted>999999999999.99 OR
    round(p_counted,2)<>p_counted OR length(coalesce(p_note,''))>500 THEN
  RAISE EXCEPTION 'Count cash carefully and enter a valid closing note'; END IF;
 SELECT * INTO v_shift FROM public.business_pos_cashier_shifts
 WHERE id=p_shift AND business_id=p_business AND cashier_id=auth.uid() AND status='open' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only the active cashier may close their open shift'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_receipts FROM public.business_pos_shift_receipts WHERE shift_id=p_shift;
 SELECT coalesce(sum(amount) FILTER(WHERE kind='cash_in'),0),
        coalesce(sum(amount) FILTER(WHERE kind='cash_out'),0)
 INTO v_in,v_out FROM public.business_pos_cash_movements WHERE shift_id=p_shift;
 v_expected:=v_shift.opening_cash+v_receipts+v_in-v_out;
 IF v_expected<0 THEN RAISE EXCEPTION 'Cash out exceeds all recorded available cash; reconcile before close'; END IF;
 UPDATE public.business_pos_cashier_shifts SET status='closed',closed_at=now(),
  counted_cash=p_counted,sales_cash_total=v_receipts,cash_in_total=v_in,cash_out_total=v_out,
  expected_cash=v_expected,variance=p_counted-v_expected,close_note=nullif(btrim(coalesce(p_note,'')),'')
 WHERE id=p_shift AND business_id=p_business;
 RETURN p_shift;
END $$;
REVOKE ALL ON FUNCTION public.business_close_pos_shift(uuid,uuid,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_close_pos_shift(uuid,uuid,numeric,text) TO authenticated;

CREATE FUNCTION public.business_review_pos_shift(p_business uuid,p_shift uuid,p_approve boolean,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_s record;v_role text;
BEGIN
 SELECT role::text INTO v_role FROM public.business_members WHERE business_id=p_business AND user_id=auth.uid();
 IF auth.uid() IS NULL OR NOT public.business_has_feature(p_business,'pos') OR v_role NOT IN ('owner','manager') THEN
  RAISE EXCEPTION 'Only owner or manager may review a closed shift' USING ERRCODE='42501'; END IF;
 IF p_approve IS NULL OR length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 SELECT * INTO v_s FROM public.business_pos_cashier_shifts WHERE id=p_shift AND business_id=p_business FOR UPDATE;
 IF NOT FOUND OR v_s.status<>'closed' THEN RAISE EXCEPTION 'Shift is not awaiting review'; END IF;
 IF v_s.cashier_id=auth.uid() AND v_role<>'owner' THEN
  RAISE EXCEPTION 'Manager cannot approve their own shift'; END IF;
 IF (v_s.variance<>0 OR NOT p_approve) AND length(btrim(coalesce(p_note,'')))<10 THEN
  RAISE EXCEPTION 'Explain cash variances or flagged reviews in at least 10 characters'; END IF;
 UPDATE public.business_pos_cashier_shifts SET status=CASE WHEN p_approve THEN 'reviewed' ELSE 'flagged' END,
  reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(btrim(coalesce(p_note,'')),'')
 WHERE id=p_shift AND business_id=p_business;
END $$;
REVOKE ALL ON FUNCTION public.business_review_pos_shift(uuid,uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_review_pos_shift(uuid,uuid,boolean,text) TO authenticated;
-- Accurate counts from ALL business rows, not a browser-limited list.
CREATE FUNCTION public.business_pos_cash_exceptions(p_business uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_missing_sales bigint;v_missing_payments bigint;v_changed bigint;v_unmatched_refunds bigint;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.business_pos_cash_exceptions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_pos_cash_exceptions(uuid) TO authenticated;

CREATE FUNCTION public.business_pos_daily_cash_report(p_business uuid,p_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result record;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.business_pos_daily_cash_report(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_pos_daily_cash_report(uuid,date) TO authenticated;
COMMIT;
