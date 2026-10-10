-- Read-only presence check. Object existence DOES NOT prove RLS or correct function behavior.
WITH objects(kind,name,present) AS (
 SELECT 'table','plan_parent_links',to_regclass('public.plan_parent_links') IS NOT NULL UNION ALL
 SELECT 'table','business_feature_grants',to_regclass('public.business_feature_grants') IS NOT NULL UNION ALL
 SELECT 'table','business_feature_grant_audit',to_regclass('public.business_feature_grant_audit') IS NOT NULL UNION ALL
 SELECT 'table','business_automation_requests',to_regclass('public.business_automation_requests') IS NOT NULL UNION ALL
 SELECT 'table','business_automation_request_events',to_regclass('public.business_automation_request_events') IS NOT NULL UNION ALL
 SELECT 'function','admin_set_plan_parent',to_regprocedure('public.admin_set_plan_parent(text,text)') IS NOT NULL UNION ALL
 SELECT 'function','admin_set_business_feature_grant',to_regprocedure('public.admin_set_business_feature_grant(uuid,text,boolean,text[],timestamptz,text)') IS NOT NULL UNION ALL
 SELECT 'function','request_business_automation',to_regprocedure('public.request_business_automation(uuid,text,text,text,text)') IS NOT NULL UNION ALL
 SELECT 'function','admin_review_automation_request',to_regprocedure('public.admin_review_automation_request(uuid,text,text,text)') IS NOT NULL UNION ALL
 SELECT 'function','respond_automation_quote',to_regprocedure('public.respond_automation_quote(uuid,boolean)') IS NOT NULL
)
SELECT kind,name,CASE WHEN present THEN 'PRESENT' ELSE 'MISSING' END AS status FROM objects ORDER BY kind,name;

SELECT schemaname,tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN
 ('plan_parent_links','business_feature_grants','business_feature_grant_audit','business_automation_requests','business_automation_request_events') ORDER BY tablename;

SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid=to_regclass('public.business_automation_requests') AND NOT tgisinternal;
