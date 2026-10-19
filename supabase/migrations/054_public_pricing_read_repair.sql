-- BusinessOS 054: Restore public pricing and CMS reads without weakening admin controls
-- Safe to run AFTER 016 and 044; does not change saved prices, plans or subscriptions.
-- Run in a transaction in Supabase SQL Editor, ideally after a database backup.
BEGIN;
DO $$
BEGIN
 IF to_regclass('public.public_site_plans') IS NULL
  OR to_regclass('public.public_site_pages') IS NULL
  THEN RAISE EXCEPTION 'Public CMS schema missing; run no further commands and review migration history'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='public_site_plans' AND policyname='administrator writes plans')
  OR NOT EXISTS (SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='public_site_pages' AND policyname='administrator writes pages')
  THEN RAISE EXCEPTION 'Administrator write policies not found. Stop and inspect existing policies before changing public reads'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='public_site_plans' AND column_name='price_monthly_ngn')
  OR NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='public_site_plans' AND column_name='price_yearly_ngn')
  THEN RAISE EXCEPTION 'Plan price columns missing; inspect migration 044 first'; END IF;
END $$;

-- Previously, the public read policies also referenced platform_admins.
-- Anonymous visitors do not need to inspect this protected table.
-- The existing administrator-write FOR ALL policies preserve admin draft access.
DROP POLICY IF EXISTS "published plans or administrator" ON public.public_site_plans;
DROP POLICY IF EXISTS "published pages or administrator" ON public.public_site_pages;
DROP POLICY IF EXISTS "businessos published plans public read" ON public.public_site_plans;
DROP POLICY IF EXISTS "businessos published pages public read" ON public.public_site_pages;

CREATE POLICY "businessos published plans public read"
 ON public.public_site_plans FOR SELECT TO anon,authenticated
 USING (published IS TRUE);
CREATE POLICY "businessos published pages public read"
 ON public.public_site_pages FOR SELECT TO anon,authenticated
 USING (published IS TRUE);

-- A row-level policy only filters rows: PostgreSQL privileges are separate.
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.public_site_plans,public.public_site_pages TO anon,authenticated;

-- A dedicated, allowlisted public catalog avoids reading unpublished plans
-- and avoids any dependency on private administrator tables in public requests.
CREATE OR REPLACE FUNCTION public.published_subscription_plan_catalog()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $catalog$
 SELECT COALESCE(
  jsonb_agg(
   jsonb_build_object(
    'id',p.id,'name',p.name,
    'price_label',p.price_label,
    'price_monthly_ngn',p.price_monthly_ngn,
    'price_yearly_ngn',p.price_yearly_ngn,
    'billing_label',p.billing_label,
    'description',p.description,
    'features',p.features,
    'cta_label',p.cta_label,
    'cta_url',p.cta_url,
    'sort_order',p.sort_order,
    'published',true
   ) ORDER BY p.sort_order,p.id
  ),
  '[]'::jsonb
 )
 FROM public.public_site_plans p
 WHERE p.published IS TRUE;
$catalog$;
REVOKE ALL ON FUNCTION public.published_subscription_plan_catalog() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.published_subscription_plan_catalog() TO anon,authenticated;
COMMIT;

-- Post-install READ-ONLY verification in SQL Editor:
-- SELECT id,name,published,price_monthly_ngn,price_yearly_ngn FROM public.public_site_plans ORDER BY sort_order;
-- SELECT has_table_privilege('anon','public.public_site_plans','SELECT') AS anonymous_plan_select;
-- SELECT policyname,roles,cmd FROM pg_policies WHERE schemaname='public'
--    AND tablename IN ('public_site_plans','public_site_pages') ORDER BY tablename,policyname;
-- SELECT jsonb_array_length(public.published_subscription_plan_catalog()) AS published_catalog_count;
-- Expect four plans on this user's current database, with only published plans in the function output.
-- This is a PUBLIC function; never include emails, business members, unpublished drafts, or private metadata.
