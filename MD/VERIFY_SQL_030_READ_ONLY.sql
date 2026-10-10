-- Phase 030D read-only installation and security inspection
WITH objects (kind, name, exists_now) AS (
 VALUES
 ('table','business_automation_rules',to_regclass('public.business_automation_rules') IS NOT NULL),
 ('table','business_automation_runs',to_regclass('public.business_automation_runs') IS NOT NULL),
 ('table','business_automation_email_jobs',to_regclass('public.business_automation_email_jobs') IS NOT NULL),
 ('table','business_automation_email_daily_budget',to_regclass('public.business_automation_email_daily_budget') IS NOT NULL),
 ('function','admin_configure_automation_rule',to_regprocedure('public.admin_configure_automation_rule(uuid,text,integer,timestamp with time zone,integer)') IS NOT NULL),
 ('function','admin_set_automation_rule_enabled',to_regprocedure('public.admin_set_automation_rule_enabled(uuid,boolean)') IS NOT NULL),
 ('function','automation_claim_email_jobs',to_regprocedure('public.automation_claim_email_jobs(integer)') IS NOT NULL),
 ('function','automation_finish_email_job',to_regprocedure('public.automation_finish_email_job(uuid,uuid,text,text,text)') IS NOT NULL)
)
SELECT kind,name,CASE WHEN exists_now THEN 'PRESENT' ELSE 'MISSING' END AS status FROM objects ORDER BY kind,name;
SELECT c.relname AS table_name,c.relrowsecurity AS row_level_security_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('business_automation_rules','business_automation_runs','business_automation_email_jobs','business_automation_email_daily_budget');
SELECT tablename,policyname,cmd FROM pg_policies
WHERE schemaname='public' AND tablename IN ('business_automation_rules','business_automation_runs','business_automation_email_jobs','business_automation_email_daily_budget') ORDER BY tablename,policyname;
