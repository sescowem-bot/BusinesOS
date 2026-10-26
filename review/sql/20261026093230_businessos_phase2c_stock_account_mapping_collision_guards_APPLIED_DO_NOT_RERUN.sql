-- ALREADY APPLIED to BusinessOS production (20261026093230).
-- ARCHIVAL SNAPSHOT ONLY; DO NOT EXECUTE AGAIN.

-- Phase 2C accounting configuration integrity: distinct cost accounts and DB-level tracked-stock enable guard.
BEGIN;
CREATE OR REPLACE FUNCTION public.gl_configure_inventory_cost_accounts(p_business uuid, p_inventory uuid, p_cogs uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
 IF EXISTS(SELECT 1 FROM public.gl_integration_settings g
  WHERE g.business_id=p_business AND
    (g.cash_account_id=p_inventory OR g.receivable_account_id=p_inventory
     OR g.expense_account_id=p_cogs))
 THEN RAISE EXCEPTION 'Inventory and COGS must use dedicated accounts, not cash, receivables or operating expenses'; END IF;
 INSERT INTO public.gl_inventory_cost_settings(
  business_id,inventory_account_id,cogs_account_id,updated_by)
 VALUES(p_business,p_inventory,p_cogs,auth.uid())
 ON CONFLICT(business_id) DO UPDATE SET inventory_account_id=excluded.inventory_account_id,
  cogs_account_id=excluded.cogs_account_id,updated_by=excluded.updated_by,updated_at=now();
END $function$;

CREATE OR REPLACE FUNCTION public.gl_configure_integration(p_business uuid, p_enabled boolean, p_cash uuid, p_receivable uuid, p_advance uuid, p_income uuid, p_delivery uuid, p_tax uuid, p_expense uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_old public.gl_integration_settings%ROWTYPE;
BEGIN
 IF NOT public.business_has_feature(p_business,'accounting') OR NOT public.business_can_perform_action(p_business,'accounting','edit') THEN RAISE EXCEPTION 'Operation denied for current plan or staff role' USING ERRCODE='42501'; END IF;
 
 IF NOT public.gl_can_manage(p_business) OR NOT public.business_has_feature(p_business,'accounting')
 THEN RAISE EXCEPTION 'Accounting permission or subscription required' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'An enabled setting is required'; END IF;
 IF EXISTS(SELECT 1 FROM public.gl_journals WHERE business_id=p_business AND source_type IN ('invoice','payment','expense','pos_sale','refund')) THEN
  SELECT * INTO v_old FROM public.gl_integration_settings WHERE business_id=p_business FOR UPDATE;
  IF NOT FOUND OR ROW(v_old.cash_account_id,v_old.receivable_account_id,v_old.advance_account_id,v_old.income_account_id,v_old.delivery_account_id,v_old.tax_account_id,v_old.expense_account_id)
    IS DISTINCT FROM ROW(p_cash,p_receivable,p_advance,p_income,p_delivery,p_tax,p_expense)
  THEN RAISE EXCEPTION 'Account mappings cannot change after source journals exist. Contact an accountant for controlled adjustments.'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_cash AND class='asset' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_receivable AND class='asset' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_advance AND class='liability' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_income AND class='income' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_delivery AND class='income' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_tax AND class='liability' AND active)
 OR NOT EXISTS(SELECT 1 FROM public.gl_accounts WHERE business_id=p_business AND id=p_expense AND class='expense' AND active)
 THEN RAISE EXCEPTION 'Every mapping must point to an active account of the correct class in this business'; END IF;
 IF p_cash=p_receivable OR p_cash=p_advance OR p_receivable=p_advance THEN
  RAISE EXCEPTION 'Cash, receivables and customer advances must use different accounts'; END IF;
 -- A tracked-product business cannot activate financial auto-posting without a
 -- separate inventory asset and cost-of-goods-sold ledger mapping.
 IF p_enabled AND EXISTS(SELECT 1 FROM public.products p
    WHERE p.business_id=p_business AND p.track_inventory=true)
   AND NOT EXISTS(SELECT 1 FROM public.gl_inventory_cost_settings c
    WHERE c.business_id=p_business)
 THEN RAISE EXCEPTION 'Configure Inventory Asset and Cost of Goods Sold accounts before enabling accounting for tracked products'; END IF;
 IF EXISTS(SELECT 1 FROM public.gl_inventory_cost_settings c
   WHERE c.business_id=p_business
   AND (c.inventory_account_id=p_cash OR c.inventory_account_id=p_receivable
        OR c.cogs_account_id=p_expense))
 THEN RAISE EXCEPTION 'Inventory and COGS accounts must be separate from cash, receivables and operating expenses'; END IF;
 INSERT INTO public.gl_integration_settings (business_id,enabled,cash_account_id,receivable_account_id,advance_account_id,income_account_id,delivery_account_id,tax_account_id,expense_account_id,updated_by)
 VALUES(p_business,p_enabled,p_cash,p_receivable,p_advance,p_income,p_delivery,p_tax,p_expense,auth.uid())
 ON CONFLICT(business_id) DO UPDATE SET enabled=EXCLUDED.enabled,cash_account_id=EXCLUDED.cash_account_id,
 receivable_account_id=EXCLUDED.receivable_account_id,advance_account_id=EXCLUDED.advance_account_id,
 income_account_id=EXCLUDED.income_account_id,delivery_account_id=EXCLUDED.delivery_account_id,
 tax_account_id=EXCLUDED.tax_account_id,expense_account_id=EXCLUDED.expense_account_id,
 updated_by=EXCLUDED.updated_by,updated_at=now();
END;
$function$;
COMMIT;
