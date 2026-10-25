import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const f=p=>readFileSync(p,'utf8');
test('core module and action checks both happen on server and fail closed',()=>{
 const s=f('lib/server/core-action-permissions.ts');
 assert.match(s,/import 'server-only'/);
 assert.match(s,/business_plan_core_feature_allowed/);
 assert.match(s,/business_can_perform_action/);
 assert.match(s,/moduleAccess\.data===true&&actionAccess\.data===true/);
 assert.match(s,/!moduleAccess\.error&&!actionAccess\.error/);
});
test('all current core writers use per-action checks before RPC operations',()=>{
 const s=f('app/(dashboard)/sales/actions.ts');
 const checks=[["'customers','create'","crm_create_customer"],["'orders','create'","crm_create_order_with_cost"],["'payments','create'","crm_record_payment"]];
 for(const [check,rpc] of checks){assert.ok(s.includes(check));assert.ok(s.indexOf(check)<s.indexOf("client.rpc('"+rpc+"')); }
 assert.match(s,/paymentState==='partial'\?coreActionAllowed/);
 const fixtures=[
 ['app/(dashboard)/expenses/actions.ts',"'expenses','create'","gl_record_paid_expense"],
 ['app/(dashboard)/invoices/actions.ts',"'documents','create'","issue_business_invoice"],
 ['app/(dashboard)/orders/[id]/cost-actions.ts',"'orders','edit'","business_record_missing_order_cost"]
 ];
 for(const [path,check,rpc] of fixtures){const file=f(path);assert.ok(file.includes(check));assert.ok(file.indexOf(check)<file.indexOf("client.rpc('"+rpc+"")||file.indexOf(check)<file.indexOf("a.client.rpc('"+rpc+""));}
});
test('writer page actions are hidden and direct form pages are also guarded',()=>{
 for(const path of ['app/(dashboard)/customers/page.tsx','app/(dashboard)/orders/page.tsx','app/(dashboard)/orders/[id]/page.tsx'])assert.match(f(path),/coreActionAllowed/);
 for(const path of ['app/(dashboard)/customers/new/page.tsx','app/(dashboard)/orders/new/page.tsx']){assert.match(f(path),/coreActionAllowed/);assert.match(f(path),/redirect\('/);}
});
test('permissions release does not flip database flags or billing code',()=>{
 const s=f('lib/server/core-action-permissions.ts');
 assert.doesNotMatch(s,/platform_plan_action_enforcement\s+set|platform_usage_enforcement\s+set|service_role|activate_paid_business_plan/);
});
