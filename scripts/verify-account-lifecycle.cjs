#!/usr/bin/env node
// Source-level regression checks only; real staging JWT/RLS tests are still required.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const workspace=read('lib/server/workspace.ts');
const onboarding=read('app/onboarding/page.tsx');
const submit=read('app/onboarding/actions.ts');
const blocked=read('app/account/access-restricted/page.tsx');
const team=read('app/(dashboard)/team/page.tsx');
const admin=read('app/admin/businesses/[id]/page.tsx');
for(const [p,s] of [[workspace,'my_blocked_membership_exists'],[workspace,'my_business_access_state'],
[onboarding,'my_blocked_membership_exists'],[submit,'my_blocked_membership_exists'],[blocked,'my_blocked_membership_exists']]){
 assert.ok(p.includes(s),'Account access checks must be retained');
}
assert.ok(workspace.includes("redirect('/account/access-restricted')"));
assert.ok(onboarding.includes("redirect('/account/access-restricted')"));
assert.ok(submit.includes("redirect('/account/access-restricted')"));
assert.ok(team.includes('business_staff_access_list'));
assert.ok(admin.includes('platform_business_lifecycle_snapshot'));
assert.ok(admin.includes('remain disabled until all legacy database permissions'));
assert.ok(!admin.includes("platform_manage_business_lifecycle("),'Unsafe lifecycle control must not be exposed');
assert.ok(!team.includes("business_manage_staff_access("),'Unsafe staff control must not be exposed');
console.log('BusinessOS account lifecycle static regression: passed. Live RLS tests remain mandatory.');
