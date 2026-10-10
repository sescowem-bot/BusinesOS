const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=(label,condition)=>{assert.ok(condition,label);};
const tsPath='/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js';
const ts=require(tsPath);
const source=read('lib/pos-pricing.ts');
const transpile=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,strict:true},reportDiagnostics:true});
assert.equal(transpile.diagnostics?.length,0,'pricing helper transpiles');
const scope={exports:{}};vm.runInNewContext(transpile.outputText,scope);
const calculate=scope.exports.previewPosPricing;
const single=[{product_id:'a',quantity:1,price:107.5,rate:750}];
const inclusive=calculate(single,'inclusive',0);
assert.equal(inclusive.subtotal,100);
assert.equal(inclusive.vat,7.5);
assert.equal(inclusive.total,107.5);
const discounted=calculate(single,'inclusive',10);
assert.equal(discounted.subtotal,100);
assert.equal(discounted.discount,10);
assert.equal(discounted.vat,6.75);
assert.equal(discounted.total,96.75);
const mixed=calculate([...single,{product_id:'b',quantity:1,price:200,rate:0}],'inclusive',30);
assert.equal(mixed.subtotal,300);
assert.equal(mixed.discount,30);
assert.equal(mixed.vat,6.75);
assert.equal(mixed.total,276.75);
assert.equal(calculate(single,'exclusive',0).total,115.56);
assert.equal(calculate(single,'inclusive',100).valid,false);
assert.equal(calculate(single,'inclusive',-1).valid,false);
const sql=read('supabase/migrations/034_reviewed_pos_price_modes_discounts.sql');
for(const [label,needle] of [
 ['additive migration','CREATE TABLE public.business_pos_pricing_contexts'],
 ['RLS','ALTER TABLE public.business_pos_pricing_contexts ENABLE ROW LEVEL SECURITY'],
 ['server price mode','p_price_mode text'],
 ['server discount','p_discount numeric'],
 ['role gate',"role IN ('owner','manager','sales')"],
 ['plan gate',"business_has_feature(p_business,'pos')"],
 ['row locking','FOR UPDATE'],
 ['idempotent request','pg_advisory_xact_lock'],
 ['tax rules','v_count<>1'],
 ['VAT inclusive',"p_price_mode='inclusive'"],
 ['discount allocation','v_discount_remaining'],
 ['atomic stock','UPDATE public.products SET stock_quantity=stock_quantity-v_qty'],
 ['invoice snapshot','invoice_pos_pricing_at_issue'],
 ['transaction','COMMIT;']])fail(label,sql.includes(needle));
fail('not backfilling historical invoices',!sql.includes('UPDATE public.business_invoices'));
const act=read('app/(dashboard)/pos/actions.ts');
fail('server invokes priced checkout through location-verified wrapper',act.includes('business_pos_checkout_at_location')&&read('supabase/migrations/039_branch_stock_locations_and_transfers.sql').includes('v_order:=public.business_pos_checkout_priced')); 
fail('server blocks advanced unreviewed',act.includes("if(!vatRegistered&&(priceMode!=='exclusive'||discount!==0))"));
const form=read('app/(dashboard)/pos/checkout-form.tsx');
fail('user selects basis',form.includes('name="price_mode"'));
fail('pre-tax discount',form.includes('name="discount"'));
fail('preview from shared math',form.includes('previewPosPricing'));
const invoice=read('app/(dashboard)/invoices/issued/[id]/page.tsx');
fail('invoice states price basis',invoice.includes('pos_pricing_context.price_mode'));
console.log('Phase 030H pricing, permission and transaction source checks passed (30 assertions).');
