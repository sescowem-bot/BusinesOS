const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');let checks=0;
function check(v,m){assert.ok(v,m);checks++;}
const start=read('app/(dashboard)/getting-started/page.tsx');
const newOrder=read('app/(dashboard)/orders/new/page.tsx');
const orders=read('app/(dashboard)/orders/page.tsx');
const customers=read('app/(dashboard)/customers/page.tsx');
const table=read('components/business-records.tsx');
const form=read('app/(dashboard)/sales/forms.tsx');
const reviewed=read('app/(dashboard)/orders/new/reviewed-tax-form.tsx');
const detail=read('app/(dashboard)/orders/[id]/page.tsx');
const css=read('app/globals.css');
check(start.includes("{count:'exact',head:true}"),'setup uses lightweight count-only queries');
check(start.includes("business_customers")&&start.includes("products")&&start.includes("orders"),'setup progress grounded in saved records');
check(start.includes('Contact BusinessOS support'),'setup help available');
check(start.includes("['owner','manager'].includes(role)"),'team role-specific help');
check(start.includes("sales?'/orders/new':'/support'"),'setup links authorised staff to ordering and other users to support');
check(newOrder.includes('if(customersResult.error||taxProfile.error)'),'tax profile errors must block unsafe order creation');
check(newOrder.includes('if(registered&&reviewed)'),'ordinary businesses skip expensive VAT rule loading');
check(newOrder.includes('mustUseTaxForm?')&&newOrder.includes('<OrderForm customers={customers}'),'show one relevant order form');
check(newOrder.includes('!reviewed?'),'registered VAT without review cannot create an ordinary unverified order');
check(newOrder.includes('initialCustomerId=customers.some'),'customer ID preselection must verify business membership');
check(form.includes('initialCustomerId')&&reviewed.includes('initialCustomerId'),'both order modes preselect customer');
check(customers.includes('encodeURIComponent(link.customer_id)'),'customer register links to prepared order');
check(customers.includes('Next step'),'customer register has action');
check(orders.includes('Review / receive payment'),'order register has payment CTA');
check(orders.includes('#payment-history')&&detail.includes('id="payment-history"'),'payment CTA reaches order section');
check(orders.includes('Understanding payment status'),'payment status terminology explained');
check(table.includes('data-label={column}'),'record table cells labelled for mobile cards');
check(table.includes('aria-label={searchLabel}'),'record search accessibility');
check(css.includes('.bo-records .bo-table td::before'),'mobile cards display field labels');
check(css.includes('.bo-creation-steps'),'guided order styling');
check(css.includes(':focus-visible'),'keyboard focus styles');
check(css.includes('@media(max-width:720px)'),'mobile responsive breakpoint');
check(read('components/shell.tsx').includes("href:'/getting-started'"),'guide in navigation');
check(read('app/(dashboard)/dashboard/page.tsx').includes('href="/getting-started"'),'guide on dashboard');
check(!newOrder.includes('taxDataUnavailable ? true : false'),'no silent tax fallback');
check(read('package.json').includes('check:phase30n-ux'),'check in npm scripts');
check(read('.github/workflows/verify.yml').includes('check:phase30n-ux'),'CI step included');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')}
for(const f of ['app/(dashboard)/getting-started/page.tsx','app/(dashboard)/orders/new/page.tsx','app/(dashboard)/orders/page.tsx','app/(dashboard)/customers/page.tsx','app/(dashboard)/orders/[id]/page.tsx','app/(dashboard)/orders/new/reviewed-tax-form.tsx','app/(dashboard)/sales/forms.tsx','components/business-records.tsx']){
 const source=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 check(source.parseDiagnostics.length===0,`${f}: ${source.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(', ')}`);
}
console.log(`Phase 030N-A UX source assertions: ${checks} passed; live browser testing remains mandatory.`);
