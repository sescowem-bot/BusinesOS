// Phase 030I source + financial-allocation regression checks (not live DB tests).
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const sql=read('supabase/migrations/035_pos_returns_refunds_credit_notes.sql');
const actions=read('app/(dashboard)/returns/actions.ts');
const forms=read('app/(dashboard)/returns/forms.tsx');
const index=read('app/(dashboard)/returns/page.tsx');
const detail=read('app/(dashboard)/returns/[id]/page.tsx');
const credit=read('app/(dashboard)/returns/credit-notes/[id]/page.tsx');
const shell=read('components/shell.tsx');
for(const k of ['business_pos_returns','business_pos_refunds','business_pos_credit_notes']){
 assert.match(sql,new RegExp(`CREATE TABLE public\\.${k}`));
 assert.match(sql,new RegExp(`ALTER TABLE public\\.${k} ENABLE ROW LEVEL SECURITY`));
 assert.match(sql,new RegExp(`GRANT SELECT ON public\\.business_pos_returns,public\\.business_pos_refunds,public\\.business_pos_credit_notes TO authenticated`));
}
for(const fn of ['business_request_pos_return','business_review_pos_return','business_complete_pos_return']){
 assert.match(sql,new RegExp(`CREATE FUNCTION public\\.${fn}\\(`));
 assert.match(sql,new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\(`));
 assert.match(sql,new RegExp(`SECURITY DEFINER SET search_path=public,pg_temp`));
 assert.ok(actions.includes(`'${fn}'`),`Missing server RPC call ${fn}`);
}
assert.ok(sql.includes('business_pos_returns_open_item'));
assert.ok(sql.includes("status='completed'"));
assert.ok(sql.includes('FOR UPDATE'));
assert.ok(sql.includes('sum(taxable_base)'));
assert.ok(sql.includes('sum(vat_amount)'));
assert.ok(sql.includes('reconciled recorded payments'));
assert.ok(sql.includes('No bank transfer')===false);
assert.ok(sql.includes('p_restock'));
assert.ok(sql.includes("'return',v_row.quantity"));
assert.ok(sql.includes('FROM public.business_pos_tax_lines'));
assert.ok(sql.includes('INSERT INTO public.business_pos_credit_notes'));
assert.ok(sql.includes('INSERT INTO public.business_pos_refunds'));
assert.ok(sql.includes('original_invoice'));
assert.ok(sql.includes('vat_credit'));
assert.ok(sql.includes('Seller')===false);
assert.ok(forms.includes('useActionState'));
assert.ok(forms.includes('Review')||forms.includes('review'));
assert.ok(forms.includes('confirmed'));
assert.ok(index.includes('fully paid POS'));
assert.ok(detail.includes('ReturnCompleteForm'));
assert.ok(credit.includes('PrintDocumentButton'));
assert.ok(shell.includes("href:'/returns'"));
// Cent-preserving cumulative pro-rata allocations, including partial fractional quantities.
function allocation(totalCents,qtyMill,prevMill,newMill){const rounded=x=>Math.round(x);return rounded(totalCents*(prevMill+newMill)/qtyMill)-rounded(totalCents*prevMill/qtyMill)}
for(const [c,q,splits] of [[1000,3000,[1000,1000,1000]],[1075,4000,[1000,1000,2000]],[1537,1250,[125,125,1000]],[1,3000,[1000,1000,1000]]]){
 let prev=0,sum=0;for(const qty of splits){const a=allocation(c,q,prev,qty);assert.ok(a>=0);sum+=a;prev+=qty;}assert.equal(prev,q);assert.equal(sum,c);
}
console.log('Phase 030I checks passed: three guarded RPCs, RLS, source flows, cent-preserving return allocations.');
