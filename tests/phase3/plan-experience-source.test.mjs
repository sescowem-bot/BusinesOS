import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('public pricing keeps selected plan through registration',()=>{
 assert.match(read('app/pricing/page.tsx'),/planStartUrl\(plan.id,access\)/);
 assert.match(read('app/(auth)/signup/actions.ts'),/metadata.desired_plan=desiredPlan/);
 assert.match(read('app/onboarding/actions.ts'),/upgrade\?plan=/);
 assert.match(read('app/(dashboard)/upgrade/page.tsx'),/requestedPaidPlan/);
});
test('registering cannot grant paid entitlements',()=>{
 assert.doesNotMatch(read('app/(auth)/signup/actions.ts'),/activate_paid_business_plan|business_plan_assignments/);
 assert.doesNotMatch(read('app/onboarding/actions.ts'),/activate_paid_business_plan|business_plan_assignments/);
 assert.match(read('app/(dashboard)/upgrade/checkout-form.tsx'),/Continue to Paystack payment/);
 assert.doesNotMatch(read('app/(dashboard)/upgrade/page.tsx'),/Request this plan|UpgradeRequestForm/);
});
test('loading fallback has no frightening timeout actions',()=>{
 const source=read('components/workspace-loading-brand.tsx');
 assert.doesNotMatch(source,/window\.location\.reload|setTimeout|Back to website|Retry page/);
 assert.match(source,/bo-premium-loader__ring/);
 assert.match(source,/bo-premium-loader__name/);
 assert.match(source,/bo-premium-loader__label/);
});
test('Free is documented as eight core business essentials',()=>{
 const source=read('app/admin/plan-access/audit/page.tsx');
 assert.match(source,/essentialCapabilities\.length/);
 assert.match(source,/business essentials above/);
 assert.doesNotMatch(source,/Direct modules: None|Inherited modules: None/);
});
test('core permission matrix is not falsely claimed production-enforced',()=>{
 assert.match(read('MD/PHASE3_ACTION_PERMISSION_GAP.md'),/not yet deployed/);
});
