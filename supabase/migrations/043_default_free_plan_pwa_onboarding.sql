-- BusinessOS Phase 030N-B / SQL 043: automatic Free plan assignment.
-- One-time additive migration AFTER 042. Does not change existing upgraded businesses.
-- The PWA itself has no SQL requirement; the plan bootstrap does.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.public_site_plans') IS NULL OR
    to_regclass('public.business_plan_assignments') IS NULL OR
    to_regclass('public.businesses') IS NULL OR
    to_regclass('public.business_members') IS NULL THEN
  RAISE EXCEPTION 'Required plan/workspace migrations 004, 016 and 017 are missing; stop and verify the current DB.';
 END IF;
 IF to_regprocedure('public.assign_default_free_plan()') IS NOT NULL THEN
  RAISE EXCEPTION 'SQL 043 appears to be installed; verify status instead of rerunning.';
 END IF;
END $$;

-- This is the real zero-price core plan, separate from the historical Starter/Pilot plan.
-- Preserve any existing editor changes with ON CONFLICT DO NOTHING.
INSERT INTO public.public_site_plans
 (id,name,price_label,billing_label,description,features,cta_label,cta_url,sort_order,published)
VALUES ('free','Free','₦0','Forever','Begin with essential business records, customers, orders, payments and expenses.',
 '["Business dashboard","Customers and orders","Payment tracking","Product and service catalogue","Expense records","Business settings"]'::jsonb,
 'Create a free workspace','/signup',0,true)
ON CONFLICT (id) DO NOTHING;

-- All new businesses, regardless of the approved creation RPC, receive a Free assignment.
-- Upgrade approval remains authoritative. Nothing here downgrades an existing plan.
CREATE FUNCTION public.assign_default_free_plan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.business_plan_assignments
  (business_id,plan_id,approved_request_id,approved_by,approved_at)
 VALUES (NEW.id,'free',NULL,NULL,now())
 ON CONFLICT (business_id) DO NOTHING;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.assign_default_free_plan() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER business_auto_assign_free_plan
 AFTER INSERT ON public.businesses
 FOR EACH ROW EXECUTE FUNCTION public.assign_default_free_plan();

-- Repair existing workspaces that were created without *any* approved plan.
-- Never alter businesses that already have Starter, Growth or another assigned plan.
INSERT INTO public.business_plan_assignments
 (business_id,plan_id,approved_request_id,approved_by,approved_at)
SELECT b.id,'free',NULL,NULL,now()
FROM public.businesses b
WHERE NOT EXISTS (SELECT 1 FROM public.business_plan_assignments a WHERE a.business_id=b.id)
ON CONFLICT (business_id) DO NOTHING;
COMMIT;
