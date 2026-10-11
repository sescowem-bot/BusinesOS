-- BusinessOS SQL 045: read-only verification; does not install or change anything.
SELECT
 to_regprocedure('public.business_dashboard_command(uuid)') IS NOT NULL AS dashboard_function_exists,
 to_regprocedure('public.business_pos_management_report(uuid,date,date)') IS NOT NULL AS underlying_pos_report_exists,
 to_regclass('public.business_company_role_profiles') IS NOT NULL AS sql_044_role_table_exists,
 coalesce((SELECT position('least(((v_to AT TIME ZONE' IN pg_get_functiondef(p.oid))>0
    FROM pg_proc p WHERE p.oid=to_regprocedure('public.business_dashboard_command(uuid)')),false)
 AS sql_045_date_limit_is_installed,
 coalesce((SELECT has_function_privilege('authenticated',p.oid,'EXECUTE')
    FROM pg_proc p WHERE p.oid=to_regprocedure('public.business_dashboard_command(uuid)')),false)
 AS signed_in_users_can_invoke_dashboard;
-- Note: This checker cannot test the signed-in user's business membership or execute the dashboard RPC.
