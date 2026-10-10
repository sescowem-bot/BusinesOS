const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
let ts; try { ts=require('typescript'); } catch { ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'); }
// Keep checks executable in CI where TypeScript is installed locally.
const src=(p)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const sql=src('supabase/migrations/031_pos_supplier_purchasing.sql');
const permissions=src('lib/plan-catalog.ts');
const nav=src('components/shell.tsx');
const check=(ok,why)=>assert.ok(ok,why);
check(sql.includes('BEGIN;')&&sql.trimEnd().endsWith('COMMIT;'),'Migration must be atomic');
check(sql.includes('FOR UPDATE')&&sql.includes('Insufficient stock'),'POS stock race protection');
check(sql.includes('UNIQUE(business_id,request_id)'),'POS retry idempotency');
check(sql.includes("v_status IS DISTINCT FROM 'draft'"),'Receiving twice must fail');
check(sql.includes("status='received'")&&sql.includes("'purchase',v_line.quantity")&&sql.includes("'sale',-v_qty"),'Stock movements missing');
check(sql.includes('CREATE POLICY')&&sql.includes('REVOKE ALL ON public.business_suppliers'),'RLS and protected writes');
check(sql.includes("public.business_has_feature(p_business,'pos')")&&sql.includes("public.business_has_feature(p_business,'purchasing')"),'DB feature gates');
check(sql.includes("public.business_has_feature(p_business,'inventory')"),'Receiving needs inventory permission');
check(sql.includes('p_customer IS NOT NULL')&&sql.includes('public.business_customers'),'Customer tenant check');
check(sql.includes('business_id=p_business AND active FOR UPDATE')||sql.includes('business_id=p_business AND active AND track_inventory FOR UPDATE'),'Product row locks');
for(const f of ['pos','purchasing']){check(permissions.includes("key:'"+f+"'"),'Feature missing from plan catalogue '+f);check(nav.includes("href:'/"+f+"'"),'Module missing from navigation '+f)}
for(const f of ['app/(dashboard)/pos/actions.ts','app/(dashboard)/purchasing/actions.ts']){
 check(src(f).includes('requireBusinessFeature'),'Missing server action entitlement gate: '+f);
 check(!src(f).includes('.from(\'products\').update'),'No direct client stock writes allowed: '+f);
}
check(src('app/(dashboard)/pos/checkout-form.tsx').includes('request_id'),'POS checkout ID missing');
check(src('app/(dashboard)/purchasing/purchase-form.tsx').includes('physically checked'),'Goods receipt requires confirmation');
check(src('app/(dashboard)/pos/page.tsx').includes('Recorded')||src('app/(dashboard)/pos/checkout-form.tsx').includes('records an already received payment'),'Must disclose no gateway processing');
check(src('MD/PHASE_030E_ACCEPTANCE.md').includes('Not tested'),'Staging tests must not be claimed as passed');
check(fs.existsSync('MD/VERIFY_SQL_031_READ_ONLY.sql'),'Missing migration checker');
// TypeScript syntax check (not semantic typing or a Next.js build).
let count=0;
for(const file of ['lib/plan-catalog.ts','components/shell.tsx','app/(dashboard)/pos/actions.ts','app/(dashboard)/pos/checkout-form.tsx','app/(dashboard)/pos/page.tsx','app/(dashboard)/purchasing/actions.ts','app/(dashboard)/purchasing/purchase-form.tsx','app/(dashboard)/purchasing/page.tsx']){
 const f=ts.createSourceFile(file,src(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(f.parseDiagnostics.length,0,`${file}: ${f.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; ')}`);
 count++;
}
console.log(`Phase 030E static safety and syntax checks passed (${count} TypeScript files). Live DB + full typecheck required.`);
