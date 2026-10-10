-- Read-only checks. Run AFTER migration 024 in the correct Supabase project.
-- This script does not insert, update, or delete data.
SELECT 'gl_integration_settings' AS object_name,
       to_regclass('public.gl_integration_settings') IS NOT NULL AS installed
UNION ALL
SELECT 'gl_source_events',to_regclass('public.gl_source_events') IS NOT NULL
UNION ALL
SELECT 'business_invoices',to_regclass('public.business_invoices') IS NOT NULL
UNION ALL
SELECT 'gl_journals',to_regclass('public.gl_journals') IS NOT NULL;

SELECT trigger_name,event_object_table,action_timing,event_manipulation
FROM information_schema.triggers
WHERE trigger_schema='public' AND trigger_name LIKE 'gl_%capture'
ORDER BY event_object_table,trigger_name;

SELECT proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN (
'gl_configure_integration','gl_post_source_event','gl_capture_source_event',
'gl_discover_existing_sources','gl_process_accounting_queue','gl_record_paid_expense')
ORDER BY proname;

-- Read-only view of installed RLS; no business financial values exposed here.
SELECT tablename,policyname,cmd,roles
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('gl_source_events','gl_integration_settings')
ORDER BY tablename,policyname;
