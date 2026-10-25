import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('review/sql/20261025_phase1b_core_rpc_rls_REVIEW_ONLY.sql','utf8');
const acceptance=readFileSync('review/sql/20261025_phase1b_verification_READ_ONLY.sql','utf8');
test('core RPC writer migration retains exact routines and adds both module and action gates',()=>{
 for(const name of ['crm_create_customer','crm_record_payment','gl_record_paid_expense'])assert.ok(sql.includes('public.'+name+'('),name);
 for(const name of ['business_plan_core_feature_allowed','business_can_perform_action','business_membership_is_active'])assert.ok(sql.includes(name),name);
 for(const module of ["'customers'","'payments'","'expenses'"])assert.ok(sql.includes(module),module);
 assert.match(sql,/SECURITY DEFINER SET search_path=public,pg_temp/);
});
test('SQL retains atomic rollout and preserves disabled enforcement',()=>{
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/COMMIT;/);
 assert.match(sql,/Action enforcement must stay disabled/);
 assert.doesNotMatch(sql,/UPDATE\s+public\.platform_plan_action_enforcement|UPDATE\s+public\.platform_usage_enforcement/i);
 assert.doesNotMatch(sql,/INSERT INTO\s+public\.business_subscription_payments/i);
});
test('restrictions cover inserts updates deletes without replacing old read policies',()=>{
 for(const name of ['businessos_core_customer_link_insert','businessos_core_customer_link_update','businessos_core_customer_link_delete','businessos_core_expense_insert','businessos_core_expense_update','businessos_core_expense_delete'])assert.ok(sql.includes(name),name);
 for(const action of ['INSERT','UPDATE','DELETE'])assert.ok(sql.includes('AS RESTRICTIVE FOR '+action+' TO authenticated'),action);
 assert.match(sql,/c\.user_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/REVOKE TRUNCATE,TRIGGER,REFERENCES/);
});
test('verification is SELECT-only and reports installed policy counts and flags',()=>{
 assert.match(acceptance,/installed_phase1b_policies/);
 assert.match(acceptance,/platform_plan_action_enforcement/);
 assert.match(acceptance,/unknown_action_allowed/);
 assert.doesNotMatch(acceptance,/\b(?:INSERT|DELETE|UPDATE|ALTER|DROP|REVOKE|GRANT|TRUNCATE|CREATE)\s+(?:INTO|FROM|TABLE|POLICY|FUNCTION|ON)/i);
});
