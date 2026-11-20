-- READ ONLY: Run in Supabase SQL Editor and inspect EVERY returned row.
-- A returned row is a public-schema table still lacking RLS; do not assume all are safe.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
  AND c.relrowsecurity = false
ORDER BY c.relname;

-- Confirm this change for the two legacy tables.
SELECT c.relname, c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_can_select,
       has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_can_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('subscription_plans','partner_organizations')
ORDER BY c.relname;
