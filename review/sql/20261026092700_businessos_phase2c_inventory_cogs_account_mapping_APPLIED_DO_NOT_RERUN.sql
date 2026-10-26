-- ALREADY APPLIED to BusinessOS production (20261026092700).
-- ARCHIVAL SNAPSHOT ONLY; DO NOT EXECUTE AGAIN.

-- Phase 2C: explicit inventory asset/COGS mapping; no existing financial rows changed.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='25000ms';
CREATE TABLE public.gl_inventory_cost_settings (
 business_id uuid PRIMARY KEY REFERENCES public.businesses(id),
 inventory_account_id uuid NOT NULL,
 cogs_account_id uuid NOT NULL,
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT gl_inventory_cost_separate CHECK (inventory_account_id<>cogs_account_id),
 CONSTRAINT gl_inventory_cost_asset_fk FOREIGN KEY (business_id,inventory_account_id)
  REFERENCES public.gl_accounts(business_id,id) ON DELETE RESTRICT,
 CONSTRAINT gl_inventory_cost_expense_fk FOREIGN KEY (business_id,cogs_account_id)
  REFERENCES public.gl_accounts(business_id,id) ON DELETE RESTRICT
);
ALTER TABLE public.gl_inventory_cost_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY gl_inventory_cost_finance_read ON public.gl_inventory_cost_settings
 FOR SELECT TO authenticated USING (
  public.gl_can_manage(business_id)
  AND public.business_has_feature(business_id,'accounting')
  AND public.business_can_perform_action(business_id,'accounting','view')
 );
REVOKE ALL ON public.gl_inventory_cost_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.gl_inventory_cost_settings TO authenticated;
CREATE OR REPLACE FUNCTION public.gl_configure_inventory_cost_accounts(
 p_business uuid,p_inventory uuid,p_cogs uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $cost$
BEGIN
 IF auth.uid() IS NULL OR NOT public.gl_can_manage(p_business)
   OR NOT public.business_membership_is_active(p_business,auth.uid())
   OR NOT public.business_has_feature(p_business,'accounting')
   OR NOT public.business_can_perform_action(p_business,'accounting','edit')
 THEN RAISE EXCEPTION 'Finance role and accounting permission required' USING ERRCODE='42501'; END IF;
 IF p_inventory IS NULL OR p_cogs IS NULL OR p_inventory=p_cogs
 THEN RAISE EXCEPTION 'Select separate inventory asset and cost-of-goods-sold accounts'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gl_accounts
   WHERE business_id=p_business AND id=p_inventory AND class='asset' AND active=true)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts
   WHERE business_id=p_business AND id=p_cogs AND class='expense' AND active=true)
 THEN RAISE EXCEPTION 'Choose active inventory asset and cost-of-goods-sold expense accounts within this business'; END IF;
 IF EXISTS(SELECT 1 FROM public.gl_journals
   WHERE business_id=p_business AND source_type IN ('pos_sale','refund'))
   AND NOT EXISTS(SELECT 1 FROM public.gl_inventory_cost_settings
     WHERE business_id=p_business AND inventory_account_id=p_inventory AND cogs_account_id=p_cogs)
 THEN RAISE EXCEPTION 'Posted stock journals lock cost account mapping; use reviewed adjusting entries'; END IF;
 INSERT INTO public.gl_inventory_cost_settings(
  business_id,inventory_account_id,cogs_account_id,updated_by)
 VALUES(p_business,p_inventory,p_cogs,auth.uid())
 ON CONFLICT(business_id) DO UPDATE SET inventory_account_id=excluded.inventory_account_id,
  cogs_account_id=excluded.cogs_account_id,updated_by=excluded.updated_by,updated_at=now();
END $cost$;
REVOKE ALL ON FUNCTION public.gl_configure_inventory_cost_accounts(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gl_configure_inventory_cost_accounts(uuid,uuid,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.gl_post_journal(uuid,date,text,text,jsonb) FROM PUBLIC,anon;
COMMIT;
