-- Phase 1D: direct REST row-access action gates for modules managed in the System Owner matrix.
-- Existing permissive tenant policies remain; these add restrictive AND conditions.
-- All changes are DDL only, transactional and additive.
BEGIN;
SET LOCAL statement_timeout='30000ms';
DO $phase$
DECLARE r record;
DECLARE v_table text;v_module text;v_roles text;v_kind text;
DECLARE v_policy text;v_expr text;
BEGIN
 FOR r IN
 SELECT * FROM (VALUES
 ('expense_categories','expenses','owner,manager,finance'),
 ('product_categories','products','owner,manager,inventory'),
 ('quotes','documents','owner,manager,finance,sales'),
 ('installment_plans','orders','owner,manager,finance,sales'),
 ('business_branches','team','owner'),
 ('business_branch_members','team','owner'),
 ('business_approval_requests','team','owner,manager,finance,sales,inventory,staff'),
 ('communication_channel_settings','communications','owner'),
 ('communication_conversations','communications','owner,manager,finance,sales,inventory,staff'),
 ('communication_messages','communications','owner,manager,finance,sales,inventory,staff'),
 ('communication_templates','communications','owner,manager,finance,sales,inventory,staff'),
 ('contact_segments','campaigns','owner'),
 ('engagement_campaigns','campaigns','owner'),
 ('growth_goals','growth','owner,manager'),
 ('growth_documents','growth','owner,manager')
 ) AS v(tbl,mod,roles)
 LOOP
  v_table:=r.tbl;v_module:=r.mod;v_roles:=r.roles;
  IF to_regclass('public.'||v_table) IS NULL THEN RAISE EXCEPTION 'Expected table % missing',v_table; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||v_table) AND relrowsecurity)
  THEN RAISE EXCEPTION 'RLS must be enabled on %',v_table; END IF;
  FOREACH v_kind IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   v_policy:=format('businessos_phase1d_%s_%s',v_table,lower(v_kind));
   IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=v_table AND policyname=v_policy)
   THEN RAISE EXCEPTION 'Policy already exists: %',v_policy; END IF;
   v_expr:=format('public.business_can_perform_action(business_id,%L,%L) AND EXISTS(SELECT 1 FROM public.business_members m WHERE m.business_id=%I.business_id AND m.user_id=auth.uid() AND m.role::text = ANY(string_to_array(%L,'','')))',v_module,CASE v_kind WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'edit' ELSE 'delete' END,v_table,v_roles);
   IF v_kind='INSERT' THEN
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)',v_policy,v_table,v_expr);
   ELSIF v_kind='UPDATE' THEN
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',v_policy,v_table,v_expr,v_expr);
   ELSE
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',v_policy,v_table,v_expr);
   END IF;
  END LOOP;
 END LOOP;
END $phase$;
COMMIT;