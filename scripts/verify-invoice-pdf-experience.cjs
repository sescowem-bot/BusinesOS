'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const invoice=read('app/(dashboard)/invoices/issued/[id]/page.tsx');
const endpoint=read('app/api/invoices/[id]/pdf/route.ts');
const pdf=read('lib/pdf/invoice-pdf.ts');
const prices=read('app/pricing/page.tsx');
const css=read('app/globals.css');
const source=read('components/print-document-button.tsx');
assert(invoice.includes('Download PDF'),'Invoice needs a separate PDF download');
assert(invoice.includes('/api/invoices/${encodeURIComponent(id)}/pdf'),'PDF endpoint should be business-scoped');
assert(!invoice.includes('immutable issuance snapshot'),'No database wording on customer invoice');
assert(!invoice.includes('NRS-validated electronic invoice'),'No technical disclaimer on customer invoice');
assert(!invoice.includes('BusinessOS commercial invoice.'),'No platform footer on the business document');
assert(invoice.includes('Invoice total')&&invoice.includes('Balance when issued'));
assert(endpoint.includes('getWorkspace')&&endpoint.includes(".eq('business_id',businessId)"),'PDF must enforce business membership');
assert(endpoint.includes('attachment; filename='),'Must download a real PDF');
assert(endpoint.includes("'Cache-Control':'private, no-store, max-age=0'"),'Do not cache customer invoices');
assert(endpoint.includes("'Content-Type':'application/pdf'"),'Response must be PDF');
assert(pdf.includes('%PDF-1.4')&&pdf.includes('startxref'),'Actual PDF generator required');
assert(source.includes('Print document')&&!source.includes('Print / Save PDF'));
assert(css.includes('@page{size:A4;margin:0}'),'Clean A4 print without browser margins');
assert(prices.includes('getPublishedPlans()')&&prices.includes('getPublishedPlanCapabilities()'),'Pricing from actual database');
assert(!prices.includes('planPaths'),'Pricing cannot invent plan tiers');
const ts=require('./load-typescript.cjs');
const compiled=ts.transpileModule(pdf,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics?.filter(d=>d.category===1).length,0);
const runtimeModule={exports:{}};
new Function('exports','require','module','Buffer',compiled.outputText)(runtimeModule.exports,name=>{
 if(name==='server-only')return {};
 if(name==='@/lib/invoice-document')return {invoiceTaxStatus:()=>({reviewed:false,label:'Tax'})};
 return require(name);
},runtimeModule,Buffer);
const output=runtimeModule.exports.createInvoicePdf({
 number:'TEST-001',issuedAt:'2026-10-11T12:00:00Z',snapshot:{
  seller:{name:'Test Business',currency:'NGN'},customer:{name:'Sample Client'},
  items:[{description:'Consulting service',quantity:2,unit_price:1000,line_total:2000}],
  subtotal:2000,tax_recorded:0,total:2000,paid_at_issue:0,
  invoice_identity:{footer_note:'Thank you for your business.'}
 }});
assert(Buffer.isBuffer(output));
assert(output.toString('ascii',0,8).startsWith('%PDF-1.4'));
assert(output.toString('ascii').includes('%%EOF'));
assert(output.toString('ascii').includes('Test Business'));
assert(!output.toString('ascii').includes('NRS-validated'));
console.log('Invoice and pricing experience: 20 source assertions and a generated PDF smoke test passed.');
