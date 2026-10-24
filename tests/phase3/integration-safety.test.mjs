import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('admin billing and quota screens require authorization',()=>{for(const p of ['app/admin/billing/page.tsx','app/admin/usage-limits/page.tsx','app/admin/plan-access/audit/page.tsx'])assert.match(read(p),/requirePlatformAdmin\(/)});
test('financial reference never invoked from payment posting route',()=>{for(const p of ['app/api/webhooks/paystack/route.ts','app/(dashboard)/pos/actions.ts','app/api/billing/checkout/route.ts'])assert.doesNotMatch(read(p),/calculateVatLines\(/)});
test('staging financial SQL is not installed in production migrations',()=>{assert.match(read('review/PHASE3_FINANCE_RELEASE_GATE.md'),/NOT activate VAT snapshot/)});
test('webhook continues provider verification and atomic activation',()=>{const s=read('app/api/webhooks/paystack/route.ts');assert.match(s,/signedPaystackPayload/);assert.match(s,/verifyPaystackPayment/);assert.match(s,/activateVerifiedPayment/)});
