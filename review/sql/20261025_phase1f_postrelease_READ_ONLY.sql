-- BusinessOS Phase 1E/1F acceptance snapshot. READ ONLY.
-- Does not activate the action matrix, mutate role memberships or edit customer records.
SELECT count(*) AS permission_policies,count(DISTINCT tablename) AS tables_covered
 FROM pg_policies WHERE schemaname='public'
 AND (policyname LIKE 'businessos_phase1_%' OR policyname LIKE 'businessos_phase1d_%' OR policyname LIKE 'businessos_phase1e_%');
SELECT count(*) FILTER(WHERE has_table_privilege('authenticated',c.oid,'TRUNCATE')) AS authenticated_truncate_tables,
 count(*) FILTER(WHERE has_table_privilege('authenticated',c.oid,'TRIGGER')) AS authenticated_trigger_tables,
 count(*) FILTER(WHERE has_table_privilege('anon',c.oid,'TRUNCATE')) AS anonymous_truncate_tables
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p');
SELECT has_function_privilege('authenticated','public.business_visible_modules(uuid)','EXECUTE') AS auth_allowed,
 has_function_privilege('anon','public.business_visible_modules(uuid)','EXECUTE') AS anon_allowed,
 public.business_visible_modules('00000000-0000-4000-8000-000000000000'::uuid) AS unknown_business;
SELECT (SELECT enabled FROM public.platform_plan_action_enforcement WHERE id=true) AS action_matrix_enabled,
 (SELECT count(*) FROM public.platform_plan_action_overrides) AS saved_action_overrides;
SELECT m.role::text,count(*) AS memberships FROM public.business_members m
 GROUP BY m.role::text ORDER BY m.role::text;
