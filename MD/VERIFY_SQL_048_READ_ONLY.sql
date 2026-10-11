-- BusinessOS 048 READ-ONLY verification. Safe whether migration is installed or not.
SELECT 'Manual subscription audit' item, to_regclass('public.business_admin_plan_audit') IS NOT NULL present
UNION ALL SELECT 'Team notices table',to_regclass('public.business_team_updates') IS NOT NULL
UNION ALL SELECT 'Manual assignment RPC',to_regprocedure('public.admin_assign_business_subscription(uuid,text,text,timestamptz)') IS NOT NULL
UNION ALL SELECT 'Team updates RPC',to_regprocedure('public.business_post_team_update(uuid,text)') IS NOT NULL
UNION ALL SELECT 'Team update RLS',COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.business_team_updates')),false)
UNION ALL SELECT 'Advanced branches protected', EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='restrict_branch_changes_to_entitled_businesses' AND NOT tgisinternal)
UNION ALL SELECT 'Advanced approvals protected', EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='restrict_approval_changes_to_entitled_businesses' AND NOT tgisinternal)
UNION ALL SELECT 'Admin audit RLS',COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.business_admin_plan_audit')),false);
