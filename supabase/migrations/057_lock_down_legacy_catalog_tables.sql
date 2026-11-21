-- BusinessOS production SQL 057: lock unused legacy public catalog tables.
-- IMPORTANT: the separate staging-review/057-062 drafts are NOT production migrations.
-- Apply to staging first. Never reapply or rename migrations 001-056.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.subscription_plans') IS NULL
     OR to_regclass('public.partner_organizations') IS NULL THEN
    RAISE EXCEPTION 'Required legacy catalog table is missing. Stop and reconcile schema.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('subscription_plans', 'partner_organizations')
  ) THEN
    RAISE EXCEPTION 'Legacy catalog has existing RLS policies. Review them before enabling RLS.';
  END IF;
END $$;

-- Keep existing rows and references. No destructive DROP or DELETE.
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_organizations ENABLE ROW LEVEL SECURITY;
-- No access policies are intentionally created.
-- Even a future accidental permissive policy must not inherit old broad grants.
REVOKE ALL ON TABLE public.subscription_plans, public.partner_organizations
  FROM PUBLIC, anon, authenticated;
COMMIT;
