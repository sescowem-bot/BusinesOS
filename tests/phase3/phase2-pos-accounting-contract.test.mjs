import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const sql=read('review/sql/20261026062759_businessos_phase2a_pos_refund_gl_event_capture_and_posting_APPLIED_DO_NOT_RERUN.sql');
const diagnosis=read('review/sql/20261026063039_businessos_phase2b_pos_tax_refund_readonly_financial_health_APPLIED_DO_NOT_RERUN.sql');
const safeTrigger=read('review/sql/20261026063321_businessos_phase2b_invoice_specific_capture_safe_branch_APPLIED_DO_NOT_RERUN.sql');
const page=read('app/(dashboard)/accounting/page.tsx');
const forms=read('app/(dashboard)/accounting/integration-forms.tsx');
const doc=read('review/PHASE2A_POS_VAT_REFUND_ACCOUNTING_20261026.md');
test('POS and confirmed external refund each capture a unique source event',()=>{
 assert.match(sql,/business_pos_sales' THEN 'pos_sale'/);
 assert.match(sql,/business_pos_refunds' THEN 'refund'/);
 assert.match(sql,/CREATE TRIGGER gl_pos_sale_capture AFTER INSERT/);
 assert.match(sql,/CREATE TRIGGER gl_pos_refund_capture AFTER INSERT/);
 assert.match(sql,/ON CONFLICT\(business_id,source_type,source_id\) DO NOTHING/);
});
test('new POS source recognises net revenue and VAT, avoiding invoice duplication',()=>{
 assert.match(sql,/source_type IN \('invoice','pos_sale'\)/);
 assert.match(sql,/POS reviewed tax-line totals are inconsistent/);
 assert.match(sql,/v_total<>v_sales\+v_tax\+v_delivery/);
 assert.match(sql,/v_settings\.tax_account_id/);
 assert.match(sql,/source_type='pos_sale' AND j.status='posted'/);
 assert.match(safeTrigger,/IF v_type='invoice' THEN/);
 assert.match(safeTrigger,/business_pos_sales s/);
});
test('refund must match credit note and existing posted sale before reversing net/VAT',()=>{
 assert.match(sql,/v_amount<>v_sales\+v_tax/);
 assert.match(sql,/Post original POS sale before the refund/);
 assert.match(sql,/v_settings\.income_account_id,v_line,v_sales,0/);
 assert.match(sql,/v_settings\.tax_account_id,v_line,v_tax,0/);
 assert.match(sql,/v_settings\.cash_account_id,v_line,0,v_amount/);
 assert.match(sql,/WHEN 'refund' THEN 3/);
});
test('accounting mappings lock after financial sources, discovery includes POS and refunds',()=>{
 assert.match(sql,/source_type IN \('invoice','payment','expense','pos_sale','refund'\)/);
 assert.match(sql,/business_pos_sales WHERE business_id=p_business/);
 assert.match(sql,/business_pos_refunds WHERE business_id=p_business/);
 assert.match(sql,/NOT EXISTS\(/);
});
test('financial health diagnostic is tenant and Accounting-role gated',()=>{
 assert.match(diagnosis,/business_membership_is_active/);
 assert.match(diagnosis,/business_can_perform_action\(p_business,'accounting','view'\)/);
 assert.match(diagnosis,/missing_pos_events/);
 assert.match(diagnosis,/pos_vat_mismatches/);
 assert.match(diagnosis,/refund_mismatches/);
 assert.match(diagnosis,/unbalanced_pos_journals/);
 assert.match(diagnosis,/FROM PUBLIC,anon/);
});
test('owner dashboard surfaces integrity and explains new accounting treatment',()=>{
 assert.match(page,/business_pos_accounting_health/);
 assert.match(page,/POS, VAT &amp; refund integrity/);
 assert.match(page,/integrityIssues/);
 assert.match(forms,/POS sales recognise revenue and VAT directly/);
 assert.match(forms,/Confirmed POS refunds reverse sale revenue/);
});
test('release notes distinguish installed code from financial integration acceptance',()=>{
 assert.match(doc,/0 POS sales, 0 POS refunds, 0 integration settings/);
 assert.match(doc,/Not yet verified/);
 assert.match(doc,/DO NOT EXECUTE|DO \*\*not\*\* replay|Do \*\*not\*\* replay/i);
});
