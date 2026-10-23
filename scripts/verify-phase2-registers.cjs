#!/usr/bin/env node
/* Phase 2 guard: no capped local-only record search or cross-business listing. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('./load-typescript.cjs');
const read=file=>fs.readFileSync(file,'utf8');
let checks=0;
function ok(test,message){assert.ok(test,message);checks++;}
const pages=['customers','orders','payments','products'];
for(const name of pages){
 const path='app/(dashboard)/'+name+'/page.tsx';
 const code=read(path);
 const ast=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 ok(ast.parseDiagnostics.length===0,'Invalid TSX in '+path);
 ok(code.includes('parseDirectory(await searchParams)'),'Server pagination query expected: '+name);
 ok(code.includes("eq('business_id',businessId)"),'Tenant-scoped lookup required: '+name);
 ok(code.includes("count:'exact'"),'Total result count required: '+name);
 ok(code.includes('.range(params.offset,params.offset+DIRECTORY_SIZE-1)'),'Page-size bound required: '+name);
 ok(code.includes("order('id',{ascending:false})")||code.includes("order('customer_id',{ascending:false})"),'Stable unique order required: '+name);
 ok(code.includes('<ServerRecordRegister'),'Shared accessible server register required: '+name);
 ok(!code.includes('.limit(200)')&&!code.includes('.limit(250)'),'No old truncated directory lookup: '+name);
}
const table='components/server-record-register.tsx';
const body=read(table),source=ts.createSourceFile(table,body,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
ok(source.parseDiagnostics.length===0,'Server register TSX must parse');
for(const s of ['method="get"','role="search"','type="search"','scope="col"','data-label={column}','prefetch={false}','directoryHref(route'])
 ok(body.includes(s),'Missing register accessibility or pagination: '+s);
const css=read('components/server-record-register.module.css');
ok(css.includes(':focus-visible')&&css.includes('@media(max-width:600px)'),'Keyboard focus and mobile layout required');
const orders=read('app/(dashboard)/orders/page.tsx');
ok(orders.includes("filter(p=>p.status==='completed')"),'Only completed payments count');
ok(orders.includes('on this page'),'Do not claim all-time financial totals from a page');
const payments=read('app/(dashboard)/payments/page.tsx');
ok(!payments.includes('method.ilike'),'Do not apply ilike to enum payment method');
const newOrder=read('app/(dashboard)/orders/new/page.tsx');
ok(newOrder.includes(".eq('customer_id',requestedCustomer)"),'Older customer deep-link membership must be verified');
ok(newOrder.includes("if(linked.error)"),'Failed verification must stop preselection');
const expense=read('app/(dashboard)/expenses/page.tsx');
ok(expense.includes('directoryHref')&&expense.includes('q={q}')&&expense.includes("eq('business_id',businessId)"),'Expense search must preserve page, query and business');
const helper=read('lib/record-directory.ts');
ok(helper.includes('Number.isSafeInteger')&&helper.includes('DIRECTORY_SIZE=25'), 'Bounded query parsing required');
ok(read('.github/workflows/verify.yml').includes('npm run test:phase2'),'Phase2 tests must run in CI');
console.log('Phase 2 register source review passed: '+checks+' assertions');
