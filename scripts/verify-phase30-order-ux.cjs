const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('supabase/migrations/036_order_creation_initial_payment.sql');
const classic=read('app/(dashboard)/sales/actions.ts');
const reviewed=read('app/(dashboard)/orders/new/reviewed-tax-actions.ts');
const payment=read('components/order-initial-payment.tsx');
const detail=read('app/(dashboard)/orders/[id]/page.tsx');
const newPage=read('app/(dashboard)/orders/new/page.tsx');
assert.match(sql,/CREATE FUNCTION public\.crm_create_order_with_initial_payment/);
assert.match(sql,/business_order_create_requests/);
assert.match(sql,/ON CONFLICT DO NOTHING/);
assert.match(sql,/payload_fingerprint/);
assert.match(sql,/created_by IS DISTINCT FROM auth\.uid/);
assert.match(sql,/p_payment_state='partial'/);
assert.match(sql,/p_payment_state='paid'/);
assert.match(sql,/v_total:=|SELECT total INTO v_total/);
assert.match(sql,/PERFORM public\.crm_record_payment/);
assert.match(sql,/public\.crm_create_tax_reviewed_order/);
assert.match(sql,/public\.crm_create_order\(/);
assert.match(sql,/REVOKE ALL ON public\.business_order_create_requests FROM PUBLIC,anon,authenticated/);
assert.match(sql,/GRANT EXECUTE .*authenticated/);
assert.doesNotMatch(sql,/UPDATE public\.business_invoices|DELETE FROM public\.orders/);
for(const src of [classic,reviewed]){
 assert.match(src,/crm_create_order_with_initial_payment|crm_create_order_with_cost/);
 assert.match(src,/p_payment_state:paymentState/);
 assert.match(src,/p_request_key:requestKey/);
 assert.match(src,/redirect\(`\/orders\/\$\{savedOrderId\}\?created=1`\)/);
}
assert.match(read('supabase/migrations/042_dashboard_support_roles.sql'),/v_order:=public.crm_create_order_with_initial_payment/);
assert.match(payment,/Not paid/);assert.match(payment,/Part payment/);assert.match(payment,/Paid in full/);
assert.match(payment,/name="payment_method"/);assert.match(payment,/name="payment_amount"/);
assert.match(detail,/paymentLabel/);assert.match(detail,/Order saved successfully/);
assert.match(newPage,/randomUUID\(\)/);assert.match(newPage,/requestKey=\{reviewedRequestKey\}/);
assert.match(read('app/(dashboard)/sales/forms.tsx'),/InitialPaymentFields/);
assert.match(read('app/(dashboard)/orders/new/reviewed-tax-form.tsx'),/InitialPaymentFields/);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
for(const rel of ['components/order-initial-payment.tsx','app/(dashboard)/sales/actions.ts','app/(dashboard)/sales/forms.tsx','app/(dashboard)/orders/new/page.tsx','app/(dashboard)/orders/new/reviewed-tax-actions.ts','app/(dashboard)/orders/new/reviewed-tax-form.tsx','app/(dashboard)/orders/[id]/page.tsx']){
 const source=ts.createSourceFile(rel,read(rel),ts.ScriptTarget.Latest,true,rel.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(source.parseDiagnostics.length,0,`TS syntax: ${rel}`);
}
console.log('Order and initial-payment source invariants passed (SQL 036 + UI + both flows).');
