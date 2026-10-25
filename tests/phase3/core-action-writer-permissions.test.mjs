import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
function checkedBefore(file,decision,rpc){
 const source=read(file),gate=source.indexOf(decision),writer=source.indexOf("rpc('"+rpc+"'");
 assert.ok(gate>=0&&writer>gate,file+' must check '+decision+' before '+rpc);
}
test('both core module grants and actions must allow the request',()=>{
 const s=read('lib/server/core-action-permissions.ts');
 assert.match(s,/server-only/);
 assert.match(s,/business_plan_core_feature_allowed/);
 assert.match(s,/business_can_perform_action/);
 assert.match(s,/!moduleAccess.error&&!actionAccess.error/);
 assert.match(s,/moduleAccess.data===true&&actionAccess.data===true/);
});
test('customer/order/payment/expense/invoice/cost actions verify permissions before writes',()=>{
 checkedBefore('app/(dashboard)/sales/actions.ts',"'customers','create'",'crm_create_customer');
 checkedBefore('app/(dashboard)/sales/actions.ts',"'orders','create'",'crm_create_order_with_cost');
 checkedBefore('app/(dashboard)/sales/actions.ts',"'payments','create'",'crm_record_payment');
 checkedBefore('app/(dashboard)/expenses/actions.ts',"'expenses','create'",'gl_record_paid_expense');
 checkedBefore('app/(dashboard)/invoices/actions.ts',"'documents','create'",'issue_business_invoice');
 checkedBefore('app/(dashboard)/orders/[id]/cost-actions.ts',"'orders','edit'",'business_record_missing_order_cost');
 assert.match(read('app/(dashboard)/sales/actions.ts'),/paymentState==='partial'\?coreActionAllowed/);
});
test('customer and order creation links and form routes are plan-and-role protected',()=>{
 for(const p of ['app/(dashboard)/customers/page.tsx','app/(dashboard)/orders/page.tsx','app/(dashboard)/orders/[id]/page.tsx'])assert.match(read(p),/coreActionAllowed/);
 for(const p of ['app/(dashboard)/customers/new/page.tsx','app/(dashboard)/orders/new/page.tsx']){
  assert.match(read(p),/coreActionAllowed/);
  assert.match(read(p),/redirect\('/);
 }
});
test('permission code does not update billing or activate enforcement flags',()=>{
 const s=read('lib/server/core-action-permissions.ts');
 assert.doesNotMatch(s,/platform_plan_action_enforcement\s+set|platform_usage_enforcement\s+set|service_role|activate_paid_business_plan/);
});
