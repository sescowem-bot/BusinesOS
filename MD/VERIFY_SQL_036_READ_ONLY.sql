-- SQL 036 READ-ONLY staging/production inspection. No schema mutations.
SELECT 'business_order_create_requests table' AS item,
       CASE WHEN to_regclass('public.business_order_create_requests') IS NOT NULL THEN 'PRESENT' ELSE 'MISSING' END AS result
UNION ALL
SELECT 'atomic order creation function',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='crm_create_order_with_initial_payment' AND p.pronargs=15) THEN 'PRESENT' ELSE 'MISSING' END
UNION ALL
SELECT 'idempotency token table RLS',
       CASE WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='business_order_create_requests' AND c.relrowsecurity) THEN 'ON' ELSE 'OFF OR MISSING' END
UNION ALL
SELECT 'direct authenticated token table privileges',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name='business_order_create_requests' AND grantee='authenticated'
       AND privilege_type IN ('INSERT','UPDATE','DELETE','SELECT')) THEN 'REVIEW REQUIRED' ELSE 'NONE (EXPECTED)' END;

-- Confirm the function is SECURITY DEFINER and available to authenticated users.
SELECT p.proname AS function_name,
       p.prosecdef AS security_definer,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='crm_create_order_with_initial_payment';
