#!/usr/bin/env node
const fs=require('node:fs');const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');const sql=read('supabase/migrations/038_partial_purchase_receipts_supplier_bills.sql');
const actions=read('app/(dashboard)/purchasing/actions.ts'),forms=read('app/(dashboard)/purchasing/purchase-form.tsx');
const purchasing=read('app/(dashboard)/purchasing/page.tsx'),inventory=read('app/(dashboard)/inventory/page.tsx');
let checks=0;function ok(v,m){assert.ok(v,m);checks++}
for(const t of ['business_purchase_receipts','business_purchase_receipt_lines','business_supplier_bills','business_supplier_bill_payments']){
 ok(sql.includes(`CREATE TABLE public.${t}`),`${t} missing`);ok(sql.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`),`${t} RLS missing`);
}
for(const f of ['business_receive_purchase_partial','business_record_supplier_bill','business_record_supplier_payment']){
 ok(sql.includes(`FUNCTION public.${f}`),`${f} RPC missing`);ok(actions.includes(f),`${f} server action missing`);
}
ok(sql.includes('business_purchase_items_received_bounds'),'overreceipt CHECK missing');
ok(sql.includes('v_item.received_quantity+v_qty>v_item.quantity'),'quantity cap missing');
ok(sql.includes('FOR UPDATE')&&sql.includes('business_purchase_orders'),'serialized receipts missing');
ok(sql.includes('UNIQUE(business_id,request_id)'),'receipt and payment idempotency missing');
ok(sql.includes('status=CASE WHEN v_total=v_done'),'PO partial state transition missing');
ok(sql.includes('REVOKE ALL ON public.business_purchase_receipts'),'receipt direct mutation lockdown missing');
ok(sql.includes('business_has_feature(p_business,\'inventory\')'),'inventory permission absent');
ok(sql.includes('business_has_feature(p_business,\'purchasing\')'),'purchasing permission absent');
ok(sql.includes("m.role IN ('owner','manager')"),'supplier billing read-role isolation missing');
ok(sql.includes('v_paid+p_amount>v_bill.invoice_amount'),'overpayment guard missing');
ok(sql.includes('WHERE id=p_bill AND business_id=p_business FOR UPDATE'),'concurrent supplier payment locking absent');
ok(sql.includes("movement_type,quantity,reference_id,notes")||sql.includes("'purchase',v_qty,v_receipt"),'stock movements missing');
ok(forms.includes('PartialReceiptForm')&&forms.includes('SupplierBillForm')&&forms.includes('SupplierPaymentForm'),'forms missing');
ok(purchasing.includes('<PartialReceiptForm')&&purchasing.includes('<SupplierBillForm')&&purchasing.includes('<SupplierPaymentForm'),'forms not rendered');
ok(purchasing.includes('partially_received')&&purchasing.includes('received_quantity'),'partial receipt status missing');
ok(purchasing.includes('financialDataReady')&&purchasing.includes('Supplier bill'),'bill load and fallback missing');
ok(inventory.includes('Restock planning'),'restock recommendation panel missing');
ok(read('package.json').includes('check:phase30k'),'package test missing');
ok(read('.github/workflows/verify.yml').includes('check:phase30k'),'CI test missing');
ok(read('MD/PHASE_030K_PARTIAL_RECEIPTS_SUPPLIER_BILLS.md').includes('branch'),'limitations documentation missing');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')}
for(const f of ['app/(dashboard)/purchasing/actions.ts','app/(dashboard)/purchasing/page.tsx','app/(dashboard)/purchasing/purchase-form.tsx','app/(dashboard)/inventory/page.tsx']){
 const parsed=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,`${f}: ${parsed.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; ')}`);checks++;
}
console.log(`Phase 030K source integrity: ${checks} checks passed. SQL execution and role/RLS live tests pending.`);
