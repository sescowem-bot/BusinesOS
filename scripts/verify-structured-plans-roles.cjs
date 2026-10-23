const {ciRuns}=require('./ci-contract.cjs');
const fs=require('fs'),assert=require('node:assert/strict');const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/044_structured_plan_entitlements_custom_company_roles.sql');
const form=read('app/admin/cms-form.tsx'),action=read('app/admin/cms-actions.ts'),plans=read('app/admin/plans/page.tsx');
const company=read('app/admin/businesses/[id]/page.tsx'),companyForms=read('app/admin/businesses/[id]/company-access-forms.tsx');
const companyActions=read('app/admin/businesses/[id]/company-access-actions.ts');
let total=0;const check=(condition,message)=>{assert.ok(condition,message);total++};
for(const obj of ['business_company_role_profiles','business_company_role_assignments','business_company_role_audit','business_feature_prices']){
 check(sql.includes(`CREATE TABLE public.${obj}`),`Table ${obj} is missing`);
 check(sql.includes(`ALTER TABLE public.${obj} ENABLE ROW LEVEL SECURITY`),`RLS ${obj} is missing`);
}
for(const func of ['admin_save_company_role','admin_assign_company_role','admin_clear_company_role','admin_set_business_feature_price']){
 check(sql.includes(`FUNCTION public.${func}`),`Function ${func} missing`);
 check(companyActions.includes(func),`Action ${func} missing`);
}
check(sql.includes('UPDATE public.platform_plan_features SET enabled=false'),'Free direct premium clean-up absent');
check(sql.includes("DELETE FROM public.plan_parent_links WHERE plan_id='free'"),'Free inheritance removal absent');
check(sql.includes('platform_free_plan_cleanup_audit'),'Free entitlement audit missing');
check(sql.includes('prevent_free_entitlement_override'),'Free protection trigger missing');
check(sql.includes('prevent_free_paid_price'),'Free cannot be priced above zero');
check(sql.includes('business_feature_grants g'),'Explicit company extras must stay effective');
check(!sql.includes('DELETE FROM public.business_feature_grants'),'Do not erase existing company exceptions');
check(sql.includes("IF v_role<>'owner' THEN"),'Owner role override missing');
check(sql.includes('v_custom.base_role<>v_role'),'Named role must never elevate base role');
check(sql.includes('p_feature_key=ANY(v_custom.allowed_modules)'),'Custom module restriction missing');
check(sql.includes("AND v_role=ANY(g.allowed_roles)"),'Existing grant-role restriction missing');
check(sql.includes('WITH RECURSIVE family'),'Inherited plan permissions lost');
check(sql.includes('FOREIGN KEY(business_id,user_id) REFERENCES public.business_members'),'Role assignment must belong to business');
check(sql.includes("IF v_member.role<>v_profile.base_role THEN"),'Custom role assignment cannot silently promote');
check(sql.includes("v_member.role='owner'"),'Cannot assign named profile to owner');
check(sql.includes("OR p_base NOT IN ('manager','finance','sales','inventory','staff')"),'Cannot create owner custom role');
check(form.includes('name="price_monthly_ngn"')&&form.includes('name="price_yearly_ngn"'),'Plan price fields missing');
check(action.includes('price_monthly_ngn:monthly')&&action.includes('price_yearly_ngn:yearly'),'Plan price write missing');
check(plans.includes('moduleWorkflowCount')&&plans.includes('moduleWorkflows'),'Detailed features missing from admin');
check(company.includes('What this company can actually use'),'Per-company entitlement breakdown missing');
check(company.includes('CompanyPriceForm')&&company.includes('CompanyRoleForm')&&company.includes('CompanyRoleAssignmentForm'),'Business admin edit panels missing');
check(companyForms.includes('Create new named role')&&companyForms.includes('Maximum additional modules'),'Custom role permissions UI missing');
check(read('app/admin/plan-access/permission-editor.tsx').includes("disabled={planId==='free'}"),'Free plan should never be enabled directly');
check(read('lib/feature-directory.ts').includes('moduleWorkflows'),'Workflow catalogue missing');
check(read('app/pricing/page.tsx').includes('price_monthly_ngn'),'Public page should show numeric prices');
check(read('app/(dashboard)/upgrade/page.tsx').includes('price_yearly_ngn'),'Customer page should show annual pricing');
check(ciRuns('check:structured-plans'),'CI gate missing');
const ts=require('./load-typescript.cjs');
for(const p of ['app/admin/businesses/[id]/company-access-actions.ts','app/admin/businesses/[id]/company-access-forms.tsx','app/admin/businesses/[id]/page.tsx','app/admin/plans/page.tsx','app/admin/cms-actions.ts','app/admin/cms-form.tsx']){
 const parsed=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 check(parsed.parseDiagnostics.length===0,`Typescript syntax error ${p}`);
}
console.log(`Plan and company roles security/source checks passed (${total} checks). SQL needs real staging execution.`);
