-- BusinessOS SQL 062 / Stage 063 -- READ-ONLY CHECK
-- Safe to run in Supabase SQL Editor. No INSERT, UPDATE, DELETE, DROP or ALTER.
-- Do not rerun migration 062 or drop existing tables based only on an 'already exists' error.
-- IMPORTANT: SQL 057-062 packages were designed for STAGING; do not apply them to production.

-- CHECK 1: Required objects, RLS settings, and the later hardened write guard.
SELECT
  to_regclass('public.platform_deletion_requests') IS NOT NULL
    AS deletion_requests_table_present,
  to_regclass('public.platform_deletion_request_events') IS NOT NULL
    AS deletion_events_table_present,
  to_regprocedure('public.submit_platform_deletion_request(text,uuid,text)') IS NOT NULL
    AS submit_request_function_present,
  to_regprocedure('public.my_platform_deletion_requests()') IS NOT NULL
    AS my_requests_function_present,
  to_regprocedure('public.platform_deletion_review_queue()') IS NOT NULL
    AS admin_queue_function_present,
  to_regprocedure('public.platform_review_deletion_request(uuid,text,text,boolean,boolean,boolean,boolean)') IS NOT NULL
    AS admin_review_function_present,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = to_regclass('public.platform_deletion_requests'))
    AS requests_rls_enabled,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = to_regclass('public.platform_deletion_request_events'))
    AS events_rls_enabled,
  COALESCE(
    strpos(pg_get_functiondef(to_regprocedure('public.enforce_active_member_tenant_write()')),
           'IF v_user IS NULL THEN') > 0,
    false
  ) AS hardened_unauthenticated_write_guard_present;

-- CHECK 2: Key schema fields used by Stage 063 governance.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'platform_deletion_requests'
  AND column_name IN (
    'id','request_type','subject_business_id','requested_by','reason',
    'status','review_note','identity_verified','retention_reviewed',
    'payment_reviewed','export_considered','reviewed_by','reviewed_at'
  )
ORDER BY column_name;

-- CHECK 3: Data count by status. Run only if the requests table is present.
-- SELECT status, count(*) AS total_requests
-- FROM public.platform_deletion_requests
-- GROUP BY status ORDER BY status;

-- If every CHECK 1 result is TRUE and the expected columns exist, SQL 062 appears installed.
-- Do not rerun it. Test the read-only RPCs in a separate STAGING environment.
-- If any check is FALSE or NULL, STOP and share the results for an additive,
-- data-preserving repair. Never use DROP TABLE or TRUNCATE as a shortcut.
