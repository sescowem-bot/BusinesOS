import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const doc=read('review/PHASE1_RELEASE_LEDGER_20261025.md');
const readOnly=read('review/sql/20261025_phase1_final_READ_ONLY.sql');
test('records every installed Phase 1 database migration by Supabase name',()=>{
 for(const name of [
  'businessos_phase1_payment_action_guard','businessos_phase1_customer_expense_rls_controls',
  'businessos_phase1_customer_and_expense_rpc_permissions',
  'businessos_phase1d_orders_invoices_permission_gate','businessos_phase1d_pos_refunds_action_guards',
  'businessos_phase1d_inventory_purchasing_accounting_guards',
  'businessos_phase1d_core_feature_enforced_in_action_helper','businessos_phase1d_team_tasks_read_permissions',
  'businessos_phase1d_staff_approvals_campaign_guards','businessos_phase1d_direct_rest_role_action_rls'
 ]) assert.ok(doc.includes(name),name);
});
test('applied snapshots are present and have per-module DB authorization',()=>{
 const pairs=[
 ['review/sql/20261025_phase1d_orders_invoices_APPLIED.sql','crm_create_order'],
 ['review/sql/20261025_phase1d_pos_refunds_APPLIED.sql','business_pos_checkout_split'],
 ['review/sql/20261025_phase1d_inventory_purchasing_accounting_APPLIED.sql','business_create_purchase'],
 ['review/sql/20261025_phase1d_core_feature_action_helper_APPLIED.sql','business_can_perform_action'],
 ['review/sql/20261025_phase1d_team_tasks_reports_APPLIED.sql','business_save_task'],
 ['review/sql/20261025_phase1d_staff_approvals_campaign_APPLIED.sql','engagement_preview_campaign'],
 ['review/sql/20261025_phase1d_direct_rest_RLS_APPLIED.sql','businessos_phase1d_'],
 ['review/sql/20261025_phase1_applied_core_procedures_SNAPSHOT.sql','crm_record_payment']
 ];
 for(const [path,fragment] of pairs){
  const source=read(path);
  assert.ok(source.includes(fragment),path);
  assert.match(source,/business_can_perform_action/);
 }
});
test('read-only release checks do not mutate customer data or activate enforcement',()=>{
 assert.match(readOnly,/pg_policies/);
 assert.match(readOnly,/platform_plan_action_enforcement/);
 assert.match(readOnly,/platform_plan_action_overrides/);
 assert.doesNotMatch(readOnly,/\b(?:INSERT|DELETE|UPDATE|CREATE|DROP|ALTER|REVOKE|GRANT|TRUNCATE)\s+(?:INTO|FROM|TABLE|POLICY|FUNCTION|ON)/i);
});
test('admin matrix editor reflects real active status instead of always claiming staged',()=>{
 const page=read('app/admin/plan-actions/page.tsx');
 const editor=read('app/admin/plan-actions/editor.tsx');
 assert.match(page,/enforced=\{live\}/);
 assert.match(editor,/enforced:boolean/);
 assert.match(editor,/action-enforcement switch is currently OFF/);
});
