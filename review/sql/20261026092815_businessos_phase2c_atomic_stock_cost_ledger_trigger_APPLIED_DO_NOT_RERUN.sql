-- ALREADY APPLIED to BusinessOS production (20261026092815).
-- ARCHIVAL SNAPSHOT ONLY; DO NOT EXECUTE AGAIN.

-- Phase 2C: append paired COGS and Inventory entries atomically when a POS accounting event becomes posted.
-- Original source event and GL posting are not rewritten. No historical postings are touched.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30000ms';
CREATE OR REPLACE FUNCTION public.gl_append_pos_inventory_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $cost$
DECLARE
 v_order uuid;
 v_stock_count integer;
 v_cost numeric(18,2);
 v_inventory uuid;
 v_cogs uuid;
 v_line integer;
 v_refund public.business_pos_returns%ROWTYPE;
 v_restocked boolean;
 v_previous_quantity numeric:=0;
 v_item public.order_items%ROWTYPE;
 v_existing_cost_entries integer;
BEGIN
 IF NEW.status<>'posted' OR OLD.status='posted'
   OR NEW.source_type NOT IN ('pos_sale','refund') THEN RETURN NEW; END IF;
 IF NEW.journal_id IS NULL THEN RAISE EXCEPTION 'Posted POS source is missing its journal'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gl_journals j
   WHERE j.id=NEW.journal_id AND j.business_id=NEW.business_id
     AND j.source_type=NEW.source_type AND j.source_id=NEW.source_id
     AND j.status='posted')
 THEN RAISE EXCEPTION 'POS accounting journal and source event disagree'; END IF;

 SELECT count(*) INTO v_existing_cost_entries FROM public.gl_lines
 WHERE business_id=NEW.business_id AND journal_id=NEW.journal_id
   AND memo IN ('POS tracked-stock cost','POS tracked-stock inventory','POS restock cost','POS restock inventory');
 IF v_existing_cost_entries<>0 THEN
   RAISE EXCEPTION 'Existing inventory cost journal requires review before retry'; END IF;
 SELECT COALESCE(max(line_no),0) INTO v_line FROM public.gl_lines
 WHERE business_id=NEW.business_id AND journal_id=NEW.journal_id;

 IF NEW.source_type='pos_sale' THEN
   SELECT s.order_id INTO v_order FROM public.business_pos_sales s
   WHERE s.id=NEW.source_id AND s.business_id=NEW.business_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'POS cost source not found'; END IF;
   -- Historical unit cost is fixed on the order item. Real stock decrement is
   -- proven by a negative inventory movement linked to this original POS order.
   SELECT count(*),COALESCE(sum(round(oi.unit_cost*oi.quantity,2)),0)
     INTO v_stock_count,v_cost FROM public.order_items oi
   WHERE oi.order_id=v_order
     AND EXISTS(SELECT 1 FROM public.inventory_movements im
       WHERE im.business_id=NEW.business_id AND im.reference_id=v_order
         AND im.product_id=oi.product_id AND im.movement_type='sale' AND im.quantity<0);
   IF v_stock_count=0 THEN RETURN NEW; END IF;
 ELSIF NEW.source_type='refund' THEN
   SELECT r.* INTO v_refund FROM public.business_pos_refunds f
    JOIN public.business_pos_returns r ON r.id=f.return_id AND r.business_id=f.business_id
   WHERE f.id=NEW.source_id AND f.business_id=NEW.business_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Refund cost source missing'; END IF;
   SELECT (c.snapshot->>'restocked')::boolean INTO v_restocked
   FROM public.business_pos_credit_notes c
   WHERE c.business_id=NEW.business_id AND c.return_id=v_refund.id;
   IF NOT FOUND OR v_restocked IS NULL THEN
     RAISE EXCEPTION 'Credit-note stock disposition missing'; END IF;
   IF NOT v_restocked THEN RETURN NEW; END IF;
   SELECT * INTO v_item FROM public.order_items oi
   WHERE oi.id=v_refund.order_item_id AND oi.order_id=v_refund.order_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Refund original cost snapshot missing'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.inventory_movements im
       WHERE im.business_id=NEW.business_id AND im.reference_id=v_refund.order_id
         AND im.product_id=v_item.product_id AND im.movement_type='sale' AND im.quantity<0)
   THEN RAISE EXCEPTION 'Restocked item was not originally deducted from stock'; END IF;
   -- Cumulative rounding allocates each cent once over fractional returns.
   SELECT COALESCE(sum(r.quantity),0) INTO v_previous_quantity
   FROM public.business_pos_returns r
   WHERE r.business_id=NEW.business_id AND r.order_item_id=v_refund.order_item_id
     AND r.id<>v_refund.id AND r.status='completed' AND r.restocked=true;
   v_cost:=round(v_item.unit_cost*(v_previous_quantity+v_refund.quantity),2)
      -round(v_item.unit_cost*v_previous_quantity,2);
 END IF;
 IF v_cost IS NULL OR v_cost<0 OR v_cost>999999999999 THEN
   RAISE EXCEPTION 'Recorded stock cost is outside allowable financial limits'; END IF;
 SELECT inventory_account_id,cogs_account_id INTO v_inventory,v_cogs
 FROM public.gl_inventory_cost_settings WHERE business_id=NEW.business_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Select an inventory asset and COGS expense account before posting stock-related POS accounting'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=NEW.business_id
      AND id=v_inventory AND class='asset' AND active=true)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=NEW.business_id
      AND id=v_cogs AND class='expense' AND active=true)
 THEN RAISE EXCEPTION 'Stock accounting mapping is inactive or has changed class'; END IF;
 IF v_cost=0 THEN RETURN NEW; END IF;
 IF NEW.source_type='pos_sale' THEN
   INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit,memo)
   VALUES
    (NEW.business_id,NEW.journal_id,v_cogs,v_line+1,v_cost,0,'POS tracked-stock cost'),
    (NEW.business_id,NEW.journal_id,v_inventory,v_line+2,0,v_cost,'POS tracked-stock inventory');
 ELSE
   INSERT INTO public.gl_lines(business_id,journal_id,account_id,line_no,debit,credit,memo)
   VALUES
    (NEW.business_id,NEW.journal_id,v_inventory,v_line+1,v_cost,0,'POS restock inventory'),
    (NEW.business_id,NEW.journal_id,v_cogs,v_line+2,0,v_cost,'POS restock cost');
 END IF;
 RETURN NEW;
END $cost$;
REVOKE ALL ON FUNCTION public.gl_append_pos_inventory_cost() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gl_pos_inventory_cost_after_post
 AFTER UPDATE OF status ON public.gl_source_events
 FOR EACH ROW
 WHEN (NEW.status='posted' AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.source_type IN ('pos_sale','refund'))
 EXECUTE FUNCTION public.gl_append_pos_inventory_cost();
COMMIT;
