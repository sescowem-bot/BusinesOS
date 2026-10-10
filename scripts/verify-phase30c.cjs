const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/029_cumulative_plans_business_grants_automation_requests.sql');
for(const s of ['admin_set_plan_parent','business_feature_grants','business_feature_grant_audit','business_has_feature','request_business_automation','admin_review_automation_request','respond_automation_quote','notify_automation_request_change','ENABLE ROW LEVEL SECURITY','REVOKE ALL'])assert(sql.includes(s),`Missing migration control ${s}`);
for(const f of ['app/admin/automations/page.tsx','app/(dashboard)/automations/requests/page.tsx','app/admin/businesses/[id]/feature-grant-form.tsx','app/admin/plans/parent-form.tsx'])assert(fs.existsSync(f),`Missing interface ${f}`);
assert(read('components/admin-workspace.tsx').includes('/admin/automations'));
assert(read('components/shell.tsx').includes('/automations/requests'));
console.log('Phase 030C static architecture checks passed. Execute database and role tests separately.');
