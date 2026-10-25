-- BusinessOS Phase 1G: final production acceptance snapshot (READ-ONLY).
-- Do not edit live financial or customer records to run these SELECT queries.
SELECT enabled,changed_at,reason FROM public.platform_plan_action_enforcement WHERE id=true;
SELECT count(*) AS configured_action_overrides FROM public.platform_plan_action_overrides;
SELECT count(*) AS action_change_audits FROM public.platform_plan_action_audit;
SELECT m.role::text AS staff_role,count(*) AS active_memberships
 FROM public.business_members m
 WHERE public.business_membership_is_active(m.business_id,m.user_id)
 GROUP BY m.role::text ORDER BY staff_role;
SELECT p.id,p.published,l.parent_plan_id,count(c.feature_key) FILTER(WHERE c.enabled) AS active_core
 FROM public.public_site_plans p
 LEFT JOIN public.plan_parent_links l ON l.plan_id=p.id
 LEFT JOIN public.platform_plan_core_features c ON c.plan_id=p.id
 GROUP BY p.id,p.published,l.parent_plan_id ORDER BY p.id;
SELECT count(*) AS phase1_restrictive_policies,count(DISTINCT tablename) AS protected_tables
 FROM pg_policies WHERE schemaname='public' AND
 (policyname LIKE 'businessos_phase1_%' OR policyname LIKE 'businessos_phase1d_%'
 OR policyname LIKE 'businessos_phase1e_%');
SELECT prosrc LIKE '%Free plan cannot explicitly allow premium modules%' AS free_premium_allow_rejected
 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='admin_save_plan_action_matrix';
SELECT has_function_privilege('authenticated','public.business_visible_modules(uuid)','EXECUTE') AS authenticated_view_allowed,
 has_function_privilege('anon','public.business_visible_modules(uuid)','EXECUTE') AS anonymous_view_denied_should_be_false;
SELECT count(*) FILTER(WHERE has_table_privilege('authenticated',c.oid,'TRUNCATE')) AS auth_truncate,
 count(*) FILTER(WHERE has_table_privilege('authenticated',c.oid,'TRIGGER')) AS auth_trigger
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p');
