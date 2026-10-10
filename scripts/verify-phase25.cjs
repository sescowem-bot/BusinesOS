const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('supabase/migrations/024_accounting_source_integration.sql');
for(const fragment of [
 'CREATE TABLE public.gl_integration_settings','CREATE TABLE public.gl_source_events',
 'CREATE FUNCTION public.gl_post_source_event','CREATE FUNCTION public.gl_capture_source_event',
 'CREATE FUNCTION public.gl_configure_integration','CREATE FUNCTION public.gl_discover_existing_sources',
 'CREATE FUNCTION public.gl_process_accounting_queue','CREATE FUNCTION public.gl_record_paid_expense',
 'CREATE TRIGGER gl_invoice_capture','CREATE TRIGGER gl_payment_capture',
 'CREATE TRIGGER gl_payment_status_capture','CREATE TRIGGER gl_expense_capture',
 'FOR UPDATE','ON CONFLICT(business_id,source_type,source_id) DO NOTHING',
 'business_has_feature','REVOKE ALL ON public.gl_source_events',
 'source_type IN (\'invoice\',\'payment\',\'expense\')'
 ])assert(sql.includes(fragment),`Required SQL guard missing: ${fragment}`);
assert(sql.includes("status='error'"),'Events must log posting failures');
assert(sql.includes('v_settings.advance_account_id'),'Payment-before-invoice treatment must support customer advances');
assert(!sql.includes('DROP TABLE'),'Migration must be additive');
assert(sql.trimEnd().endsWith('COMMIT;'),'Migration must close its transaction');
assert((sql.match(/\$\$/g)||[]).length%2===0,'Unpaired function delimiters');
assert(!fs.existsSync(path.join(root,'docs')),'Old docs directory not cleaned');
assert(fs.existsSync(path.join(root,'README.md')));
const remaining=fs.readdirSync(root).filter(f=>f.endsWith('.md')&&f!=='README.md');
assert.equal(remaining.length,0,`Markdown still in project root: ${remaining.join(', ')}`);
assert(fs.existsSync(path.join(root,'MD','PHASE_025_ACCOUNTING_INTEGRATION.md')));
assert(read('app/(dashboard)/accounting/integration-actions.ts').includes("requireBusinessFeature('accounting')"));
const expenseAction=read('app/(dashboard)/expenses/actions.ts');
const expensePage=read('app/(dashboard)/expenses/page.tsx');
assert(expenseAction.includes('getWorkspace()'),'Expense writes must validate workspace membership');
assert(expenseAction.includes("['owner','manager','finance'].includes(a.role)"),'Expense writes must require finance roles');
assert(expenseAction.includes("client.rpc('gl_record_paid_expense'"),'Expense writes must use guarded database RPC');
assert(expensePage.includes('getWorkspace()'),'Expense page must validate workspace membership');
assert(!expenseAction.includes("requireBusinessFeature('expenses')"),'Core expenses cannot pass as paid-only feature');
assert(!expensePage.includes("requireBusinessFeature('expenses')"),'Core expenses cannot pass as paid-only feature');
const ts=require('typescript');
let count=0;
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  if(item.name==='node_modules'||item.name==='.next')continue;
  const file=path.join(dir,item.name);if(item.isDirectory())walk(file);
  else if(/\.tsx?$/.test(item.name) && item.name!=='next-env.d.ts'){
    const src=fs.readFileSync(file,'utf8');const out=ts.transpileModule(src,{fileName:file,
      compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
    const issues=(out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
    assert.equal(issues.length,0,`TypeScript syntax error in ${file}: ${issues.map(x=>x.messageText).join('; ')}`);
    count++;
  }
}}
for(const d of ['app','lib','components'])walk(path.join(root,d));
console.log(`Phase 025 checks passed: ${count} TS/TSX files parse, accounting SQL and Markdown layout guards present. Live DB checks still required.`);
