#!/usr/bin/env node
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/040_premium_pos_held_carts_split_tenders.sql');
const form=read('app/(dashboard)/pos/checkout-form.tsx');
const page=read('app/(dashboard)/pos/page.tsx');
const actions=read('app/(dashboard)/pos/actions.ts');
const held=read('app/(dashboard)/pos/held-actions.ts');
const receipt=read('app/(dashboard)/pos/receipts/[id]/page.tsx');
let count=0;function check(x,msg){assert.ok(x,msg);count++}
for(const t of ['business_pos_held_carts','business_pos_split_checkouts']){
 check(sql.includes(`CREATE TABLE public.${t}`),`${t} exists`);
 check(sql.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`),`${t} RLS`);
 check(sql.includes(`REVOKE ALL ON public.${t}`),`${t} no direct writes`);
}
for(const f of ['business_save_pos_cart','business_delete_pos_cart','business_pos_checkout_split']){
 check(sql.includes(`CREATE FUNCTION public.${f}`),`${f} defined`);
 check(sql.includes(`public.${f}(`),`${f} grant/revoke`);
}
check(sql.includes('p_request::text,0'), 'transaction-specific idempotency lock');
check(sql.includes('request_fingerprint<>v_fingerprint'),'idempotent request payload protected');
check(sql.includes('jsonb_array_length(p_tenders) NOT BETWEEN 2 AND 3'), '2–3 tenders only');
check(sql.includes("round(v_amount,2)<>v_amount"),'tender precision checked');
check(sql.includes('v_paid>v_total'),'prevent overpayment');
check(sql.includes('crm_record_payment('),'reuse safe payment RPC');
check(sql.includes('business_pos_checkout_at_location('),'branch and VAT checkout entry point retained');
check(sql.includes('v_registered AND NOT v_reviewed'),'registered VAT without review blocked');
check(sql.includes('payment_recorded=true'),'sale flagged with recorded payments');
check(sql.includes("status='completed'::public.order_status"),'fully paid order status');
check(sql.includes('cashier_id=auth.uid()'),'held cart limited to own cashier');
check(sql.includes("'pos-carts:'||p_business"),'concurrent held-cart limit serialized');
check(sql.includes('pos_vat_guard_before_sale'),'direct RPC VAT guard installed');
check(sql.includes("SELECT 1 FROM public.business_branch_members"),'branch assignment checked for cashier');
check(sql.includes('business_pos_held_carts WHERE id=p_cart AND'),'cart cannot overwrite someone else');
check(sql.includes('public.business_pos_held_carts.cashier_id=EXCLUDED.cashier_id')&&sql.includes('IF v_id IS NULL THEN'),'conflicting held-cart writes cannot cross cashier ownership even under race');
check(sql.includes('MAX')===false,'avoid fake MAX performance claim');
check(held.includes('requireBusinessFeature')&&held.includes('business_save_pos_cart')&&held.includes('business_delete_pos_cart'),'held RPCs called through authenticated actions');
check(actions.includes('business_pos_checkout_split')&&actions.includes('tenders')&&actions.includes("vatRegistered&&profile?.classification_status!=='reviewed'"),'guarded split action');
check(form.includes('onKeyDown')&&form.includes('p.sku'),'SKU scanner support');
check(form.includes('hold=')&&form.includes('restoreHeld=')&&form.includes('discardPosCart'),'held cart UX');
check(form.includes('tenderMode')&&form.includes('invalidTenders'),'split payment UX');
check(page.includes('heldResult.error')&&page.includes('heldCarts='),'fail-closed held cart query');
check(receipt.includes("business_pos_sales")&&receipt.includes('payments(')&&receipt.includes('PrintDocumentButton'),'receipt derived from saved POS sale and payments');
check(receipt.includes('does not verify bank/card settlement')&&receipt.includes('NRS-validated'),'receipt does not claim validated tax/bank settlement');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')}
for(const file of ['app/(dashboard)/pos/actions.ts','app/(dashboard)/pos/held-actions.ts','app/(dashboard)/pos/checkout-form.tsx','app/(dashboard)/pos/page.tsx','app/(dashboard)/pos/receipts/[id]/page.tsx']){
 const content=read(file),parsed=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,`${file} syntax failure`);count++;
}
console.log(`Phase 030L source invariants: ${count} passed. Live PostgreSQL and Next.js build remain required.`);
