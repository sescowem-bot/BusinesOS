import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const base='review/sql/';
const mapping=read(base+'20261026092700_businessos_phase2c_inventory_cogs_account_mapping_APPLIED_DO_NOT_RERUN.sql');
const cost=read(base+'20261026092815_businessos_phase2c_atomic_stock_cost_ledger_trigger_APPLIED_DO_NOT_RERUN.sql');
const health=read(base+'20261026093107_businessos_phase2c_stock_cogs_financial_health_metrics_APPLIED_DO_NOT_RERUN.sql');
const guard=read(base+'20261026093230_businessos_phase2c_stock_account_mapping_collision_guards_APPLIED_DO_NOT_RERUN.sql');
const actions=read('app/(dashboard)/accounting/integration-actions.ts');
const forms=read('app/(dashboard)/accounting/integration-forms.tsx');
const page=read('app/(dashboard)/accounting/page.tsx');
test('cost mapping is scoped to business accounts with finance-only writes',()=>{
 assert.match(mapping,/CREATE TABLE public\.gl_inventory_cost_settings/);
 assert.match(mapping,/FOREIGN KEY \(business_id,inventory_account_id\)/);
 assert.match(mapping,/FOREIGN KEY \(business_id,cogs_account_id\)/);
 assert.match(mapping,/business_membership_is_active/);
 assert.match(mapping,/business_can_perform_action\(p_business,'accounting','edit'\)/);
 assert.match(mapping,/REVOKE EXECUTE ON FUNCTION public\.gl_post_journal/);
});
test('POS stock cost uses recorded unit cost and actual negative inventory movement',()=>{
 assert.match(cost,/AFTER UPDATE OF status ON public\.gl_source_events/);
 assert.match(cost,/OLD\.status IS DISTINCT FROM NEW\.status/);
 assert.match(cost,/im\.movement_type='sale' AND im\.quantity<0/);
 assert.match(cost,/oi\.unit_cost\*oi\.quantity/);
 assert.match(cost,/v_cogs,v_line\+1,v_cost,0/);
 assert.match(cost,/v_inventory,v_line\+2,0,v_cost/);
});
test('restocked refunds restore inventory and reverse COGS but not when stock is disposed of',()=>{
 assert.match(cost,/c\.snapshot->>'restocked'/);
 assert.match(cost,/IF NOT v_restocked THEN RETURN NEW/);
 assert.match(cost,/v_previous_quantity\+v_refund\.quantity/);
 assert.match(cost,/v_inventory,v_line\+1,v_cost,0/);
 assert.match(cost,/v_cogs,v_line\+2,0,v_cost/);
});
test('finance configuration validates mappings and prevents auto-post with uncosted tracked inventory',()=>{
 assert.match(guard,/inventory_account_id=p_cash/);
 assert.match(guard,/cogs_account_id=p_expense/);
 assert.match(guard,/p\.track_inventory=true/);
 assert.match(guard,/Configure Inventory Asset and Cost of Goods Sold/);
 assert.match(actions,/configureInventoryCostAccounts/);
 assert.match(actions,/gl_configure_inventory_cost_accounts/);
 assert.match(actions,/confirm_cost_policy/);
 assert.match(forms,/name="inventory"/);
 assert.match(forms,/name="cogs"/);
});
test('financial integrity UI detects missing COGS or restock journals',()=>{
 assert.match(health,/uncosted_posted_pos_sales/);
 assert.match(health,/unreversed_restock_costs/);
 assert.match(page,/business_pos_accounting_health/);
 assert.match(page,/uncosted_posted_pos_sales/);
 assert.match(page,/unreversed_restock_costs/);
});
test('reports identify unfinished purchase, opening balance and end-to-end acceptance work',()=>{
 const doc=read('review/PHASE2C_COGS_AND_STOCK_20261026.md');
 assert.match(doc,/not a complete inventory valuation/);
 assert.match(doc,/Not yet completed/);
 assert.match(doc,/must NOT be replayed/);
});
