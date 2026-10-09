-- Phase 04 workspace troubleshooting: READ ONLY. Run in Supabase SQL Editor.
-- SQL Editor is not a signed-in app session. auth.uid() there is normally NULL.
SELECT 'workspace_function' AS check_name,
       EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='create_my_business_workspace'
                AND pg_get_function_identity_arguments(p.oid)='p_name text, p_category text')::text AS result
UNION ALL
SELECT 'profiles_table', (to_regclass('public.profiles') IS NOT NULL)::text
UNION ALL
SELECT 'businesses_table', (to_regclass('public.businesses') IS NOT NULL)::text
UNION ALL
SELECT 'business_members_table', (to_regclass('public.business_members') IS NOT NULL)::text
UNION ALL
SELECT 'profile_creation_trigger', EXISTS(
 SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='auth' AND c.relname='users' AND t.tgname='on_auth_user_created' AND NOT t.tgisinternal
)::text;

SELECT p.oid::regprocedure AS function_signature,
       p.prosecdef AS security_definer,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='create_my_business_workspace';

-- Do not share email addresses or auth tokens. This shows counts only.
SELECT (SELECT count(*) FROM auth.users) AS auth_users,
       (SELECT count(*) FROM public.profiles) AS profiles,
       (SELECT count(*) FROM auth.users a LEFT JOIN public.profiles p ON p.id=a.id WHERE p.id IS NULL) AS users_missing_profiles;
