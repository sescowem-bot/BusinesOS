-- Phase 030: read-only installation / security inspection. No data changes.
SELECT 'platform_pilot_results' AS object_name, to_regclass('public.platform_pilot_results') IS NOT NULL AS exists
UNION ALL SELECT 'platform_pilot_audit',to_regclass('public.platform_pilot_audit') IS NOT NULL
UNION ALL SELECT 'platform_record_pilot_check',to_regprocedure('public.platform_record_pilot_check(text,text,text,text)') IS NOT NULL;

SELECT schemaname,tablename,rowsecurity
FROM pg_tables
WHERE schemaname='public' AND tablename IN ('platform_pilot_results','platform_pilot_audit')
ORDER BY tablename;

SELECT schemaname,tablename,policyname,roles,cmd,qual
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('platform_pilot_results','platform_pilot_audit');

-- NOTE: Successful inspection does not prove RLS is correctly enforced for a
-- non-admin authenticated user. Test that in staging with a different account.
