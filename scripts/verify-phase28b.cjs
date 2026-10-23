const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const table=read('components/business-records.tsx');
const pagination=read('lib/record-table-view.ts');
const helpers=read('components/business-page-ui.tsx');
assert.match(table,/useMemo/,'Search uses a calculated filtered list');
assert.match(table,/input type="search"/);
assert.match(table,/aria-live="polite"/);
assert.match(table,/setPage\(1\)/,'Changing filters resets pagination');
assert.match(table,/getRecordPage\(rows,search,status,page,size\)/,'Table uses shared pagination');
assert.match(pagination,/Math\.min\(pages,Math\.max\(1,requestedPage\)\)/,'Pagination clamps after filtering');
assert.match(table,/\b20\b/,'Page size is explicit');
assert.match(helpers,/BusinessPageHeading/);
assert.match(helpers,/BusinessAlert/);
for(const p of ['customers','orders','products','payments','invoices']){
 const source=read(`app/(dashboard)/${p}/page.tsx`);
 if(/ServerRecordRegister/.test(source)){
  assert.match(source,/\.range\(/,'Server register must have a page bound: '+p);
  assert.match(source,/count:'exact'/,'Server register must report exact count: '+p);
 }else{
  assert.match(source,/BusinessRecordsTable/,'Legacy pages use bounded client-side tables: '+p);
  assert.match(source,/\.limit\(/,'Legacy pages must be bounded: '+p);
 }
 assert.match(source,/\.eq\('business_id',businessId\)/,'Records must be scoped to active business: '+p);
 assert.match(source,/BusinessPageHeading/);
 assert.match(source,/BusinessSection/);

 assert.doesNotMatch(source,/Demo Business|sample customer|fake customer/i);
}
const detail=read('app/(dashboard)/orders/[id]/page.tsx');
assert.match(detail,/eq\('business_id',businessId\)/);
assert.match(detail,/canManage/);
assert.match(detail,/!cancelled&&canManage/);
for(const p of ['customers/new','orders/new']) assert.match(read(`app/(dashboard)/${p}/page.tsx`),/bo-form-panel/);
const css=read('app/globals.css');
assert.match(css,/\.bo-table-tools/);
assert.match(css,/@media\(max-width:720px\)/);
assert.match(css,/bo-visually-hidden/);
assert.match(css,/prefers-reduced-motion/);
const markdown=fs.readdirSync(root).filter(x=>x.endsWith('.md')&&x!=='README.md');
assert.equal(markdown.length,0,'Root should contain only README.md');
console.log('Phase 028B component, tenant boundary, navigation, search, responsiveness and docs checks: PASS');
