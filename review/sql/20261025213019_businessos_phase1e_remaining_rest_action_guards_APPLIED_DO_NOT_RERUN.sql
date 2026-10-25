-- APPLIED IN PRODUCTION: 20261025213019 (businessos_phase1e_remaining_rest_action_guards).
-- ARCHIVAL COPY ONLY; DO NOT EXECUTE OR REPLAY.
-- Captured from supabase_migrations.schema_migrations on 25 October 2026.

-- Phase 1E: constrain remaining business-scoped direct Data API writes.
-- Existing positive owner/tenant policies stay in place; restrictive policies add AND gates.
BEGIN;
SET LOCAL statement_timeout = '30000ms';
DO $gate$
DECLARE r record;
DECLARE op text;
DECLARE policy_name text;
DECLARE expr text;
BEGIN
 FOR r IN SELECT * FROM (VALUES
   ('business_invoice_profiles','settings','owner'),
   ('business_tax_profiles','settings','owner'),
   ('business_supply_categories','settings','owner'),
   ('engagement_automations','campaigns','owner')
 ) AS choices(tbl,module_key,allowed_roles)
 LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||r.tbl) AND relrowsecurity) THEN
    RAISE EXCEPTION 'Missing or unprotected RLS table: %',r.tbl;
  END IF;
  FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
    policy_name:=format('businessos_phase1e_%s_%s',r.tbl,lower(op));
    expr:=format(
      'public.business_can_perform_action(business_id,%L,%L) AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=%I.business_id AND m.user_id=auth.uid() AND m.role::text=ANY(string_to_array(%L,'','')))',
      r.module_key,
      CASE op WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'edit' ELSE 'delete' END,
      r.tbl, r.allowed_roles
    );
    IF op='INSERT' THEN EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)',policy_name,r.tbl,expr);
    ELSIF op='UPDATE' THEN EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',policy_name,r.tbl,expr,expr);
    ELSE EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',policy_name,r.tbl,expr);
    END IF;
  END LOOP;
 END LOOP;
END $gate$;
CREATE POLICY businessos_phase1e_quote_items_create ON public.quote_items AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (EXISTS(SELECT 1 FROM public.quotes q JOIN public.business_members m ON m.business_id=q.business_id
 WHERE q.id=quote_items.quote_id AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales')
 AND public.business_can_perform_action(q.business_id,'documents','create')));
CREATE POLICY businessos_phase1e_quote_items_edit ON public.quote_items AS RESTRICTIVE FOR UPDATE TO authenticated
USING (EXISTS(SELECT 1 FROM public.quotes q JOIN public.business_members m ON m.business_id=q.business_id
 WHERE q.id=quote_items.quote_id AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales')
 AND public.business_can_perform_action(q.business_id,'documents','edit')))
WITH CHECK (EXISTS(SELECT 1 FROM public.quotes q JOIN public.business_members m ON m.business_id=q.business_id
 WHERE q.id=quote_items.quote_id AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales')
 AND public.business_can_perform_action(q.business_id,'documents','edit')));
CREATE POLICY businessos_phase1e_quote_items_delete ON public.quote_items AS RESTRICTIVE FOR DELETE TO authenticated
USING (EXISTS(SELECT 1 FROM public.quotes q JOIN public.business_members m ON m.business_id=q.business_id
 WHERE q.id=quote_items.quote_id AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales')
 AND public.business_can_perform_action(q.business_id,'documents','delete')));
CREATE POLICY businessos_phase1e_installment_schedule_create ON public.installment_schedule AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (EXISTS(SELECT 1 FROM public.installment_plans i JOIN public.business_members m ON m.business_id=i.business_id
 WHERE i.id=installment_schedule.plan_id AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales')
 AND public.business_can_perform_action(i.business_id,'orders','create')));
CREATE POLICY businessos_phase1e_installment_schedule_edit ON public.installment_schedule AS RESTRICTIVE FOR UPDATE TO authenticated
USING (EXISTS(SELECT 1 FROM public.installment_plans i JOIN public.business_members m ON m.business_id=i.business_id
 WHERE i.id=installment_schedule.plan_id AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales')
 AND public.business_can_perform_action(i.business_id,'orders','edit')))
WITH CHECK (EXISTS(SELECT 1 FROM public.installment_plans i JOIN public.business_members m ON m.business_id=i.business_id
 WHERE i.id=installment_schedule.plan_id AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales')
 AND public.business_can_perform_action(i.business_id,'orders','edit')));
CREATE POLICY businessos_phase1e_installment_schedule_delete ON public.installment_schedule AS RESTRICTIVE FOR DELETE TO authenticated
USING (EXISTS(SELECT 1 FROM public.installment_plans i JOIN public.business_members m ON m.business_id=i.business_id
 WHERE i.id=installment_schedule.plan_id AND m.user_id=auth.uid() AND m.role IN ('owner','manager','finance','sales')
 AND public.business_can_perform_action(i.business_id,'orders','delete')));
-- Owners close businesses through the audited lifecycle instead of unrestricted REST DELETE.
REVOKE DELETE ON public.businesses FROM PUBLIC,anon,authenticated;
CREATE POLICY businessos_phase1e_business_settings_edit ON public.businesses AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.business_can_perform_action(id,'settings','edit') AND public.is_business_owner(id))
WITH CHECK (public.business_can_perform_action(id,'settings','edit') AND public.is_business_owner(id));
COMMIT;
