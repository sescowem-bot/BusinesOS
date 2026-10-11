const fs=require('fs'),assert=require('assert');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/048_admin_plan_controls_team_updates.sql');
const menu=read('components/shell.tsx');
const exportRoute=read('app/api/business/export/route.ts');
const team=read('app/(dashboard)/team/updates/page.tsx');
const teamManage=read('app/(dashboard)/team/page.tsx');
const teamActions=read('app/(dashboard)/team/actions.ts');
const admin=read('app/admin/businesses/[id]/manual-plan-actions.ts');
const pricing=read('app/pricing/page.tsx');
const brand=read('app/admin/branding-form.tsx');
const checks=[
 ['migration guarded',sql.includes("business_subscription_payments")&&sql.includes("business_tasks")&&sql.includes('BEGIN;')&&sql.includes('COMMIT;')],
 ['subscription manual audit',sql.includes('business_admin_plan_audit')&&sql.includes('changed_by')],
 ['manual change requires platform admin',sql.includes('FROM public.platform_admins WHERE user_id=auth.uid() AND active')],
 ['manual change cannot be anonymous',sql.includes('REVOKE ALL ON FUNCTION public.admin_assign_business_subscription')],
 ['manual admin action uses RPC',admin.includes("rpc('admin_assign_business_subscription'")],
 ['only published plans assigned',sql.includes('WHERE id=p_plan AND published')],
 ['team messages use business membership RLS',sql.includes('business_team_updates_business_members_only')||sql.includes('team_updates_business_members_only')],
 ['advanced branches require plan feature (database)',sql.includes('restrict_branch_changes_to_entitled_businesses')&&sql.includes("public.business_has_feature(NEW.business_id,'team')")],
 ['advanced approvals require plan feature (database)',sql.includes('restrict_approval_changes_to_entitled_businesses')],
 ['advanced team controls hidden when unentitled',teamManage.includes('advanced&&<section')],
 ['advanced team actions require entitlement',teamActions.includes('requireAdvancedTeam(w)')],
 ['team updates no public writes',sql.includes('REVOKE ALL ON public.business_team_updates FROM PUBLIC,anon,authenticated')],
 ['team updates are internal',team.includes('Only registered members of this business')],
 ['record exports owner only',exportRoute.includes("role!=='owner'")],
 ['records scoped to business',exportRoute.includes(".eq('business_id',businessId)")],
 ['record exports prevent silent truncation',exportRoute.includes('count>MAX_RECORDS')&&exportRoute.includes('records.length>MAX_RECORDS')],
 ['exports protect CSV',exportRoute.includes('csv(')],
 ['nav links exports',menu.includes("href:'/exports'")],
 ['nav links team updates',menu.includes("href:'/team/updates'")],
 ['nav entitlement check',menu.includes('enabledFeatures.includes')],
 ['unreleased campaigns not advertised',pricing.includes('releasedPaidCapabilities')],
 ['system owner can rename platform',brand.includes('Platform name')]
];
for(const [name,ok] of checks)assert.ok(ok,`Missing protection: ${name}`);
console.log('Product UX verification: '+checks.length+' checks passed');
