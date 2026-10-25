import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const doc=readFileSync('review/PHASE1_PRODUCTION_HARDENING_20261025.md','utf8');
const sql=readFileSync('review/sql/20261025_phase1_live_READ_ONLY.sql','utf8');
test('production hardening notes name all applied migrations and explicitly retain the final gate',()=>{
 for(const n of ['businessos_phase1_payment_action_guard','businessos_phase1_customer_expense_rls_controls','businessos_phase1_customer_and_expense_rpc_permissions'])assert.ok(doc.includes(n));
 assert.match(doc,/remains `false`/);
 assert.match(doc,/must NOT be enabled/);
});
test('verification is read-only and checks uncovered privileged functions',()=>{
 assert.match(sql,/pg_policies/);
 assert.match(sql,/business_can_perform_action/);
 assert.match(sql,/business_pos_checkout_split/);
 assert.match(sql,/platform_plan_action_enforcement/);
 assert.doesNotMatch(sql,/\b(?:INSERT|DELETE|UPDATE|DROP|CREATE|ALTER|REVOKE|GRANT|TRUNCATE)\s+(?:INTO|FROM|TABLE|POLICY|FUNCTION|ON)/i);
});
