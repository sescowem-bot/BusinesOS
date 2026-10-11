-- BusinessOS prerelease plan and renewal check (READ ONLY)
SELECT 'SQL 048 present' AS test,to_regclass('public.business_admin_plan_audit') IS NOT NULL AS ready
UNION ALL SELECT 'SQL 049 plan matrix',to_regprocedure('public.admin_apply_standard_plan_matrix(text)') IS NOT NULL
UNION ALL SELECT 'SQL 050 installment plans',to_regclass('public.business_order_installment_plans') IS NOT NULL
UNION ALL SELECT 'SQL 050 subscription renewals',to_regclass('public.platform_subscription_reminders') IS NOT NULL
UNION ALL SELECT 'SQL 050 customer reminders',to_regclass('public.business_order_reminders') IS NOT NULL;
-- Source-of-truth comparison AFTER applying standard plans intentionally (not just SQL 049):
SELECT p.id,p.name,p.published,p.price_monthly_ngn,p.price_yearly_ngn,
 array_agg(f.feature_key ORDER BY f.feature_key) FILTER(WHERE f.enabled) AS directly_enabled_modules
FROM public.public_site_plans p
LEFT JOIN public.platform_plan_features f ON f.plan_id=p.id
WHERE p.id IN ('free','starter','growth','professional')
GROUP BY p.id,p.name,p.published,p.price_monthly_ngn,p.price_yearly_ngn ORDER BY p.id;
-- Legacy inheritance can add modules: inspect parent links before judging effective access.
SELECT plan_id,parent_plan_id FROM public.plan_parent_links WHERE plan_id IN ('starter','growth','professional');
-- Keep these distinct: subscription expiry is NOT the amount a customer owes.
SELECT a.plan_id,count(*) AS assigned_companies FROM public.business_plan_assignments a GROUP BY a.plan_id ORDER BY a.plan_id;
