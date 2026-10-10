#!/usr/bin/env node
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/041_wholesale_pricing_pos_reporting.sql');
const report=read('app/(dashboard)/retail-reports/page.tsx'),wholesale=read('app/(dashboard)/wholesale/page.tsx');
const actions=read('app/(dashboard)/wholesale/actions.ts');let assertions=0;
const check=(condition,label)=>{assert.ok(condition,label);assertions++};
for(const name of ['business_wholesale_price_tiers','business_set_wholesale_price_tier','business_delete_wholesale_price_tier','business_wholesale_price_quote','business_pos_management_report'])check(sql.includes(name),`Missing SQL object ${name}`);
check(sql.includes('CREATE INDEX orders_business_created_retail'),'period index missing');
check(sql.includes('CREATE INDEX wholesale_tier_product_lookup'),'price lookup index missing');
check(sql.includes("business_has_feature(p_business,'financial_reports')"),'report subscription guard absent');
check(sql.includes("role IN ('owner','manager','finance')"),'report role guard absent');
check(sql.includes("role IN ('owner','manager')"),'wholesale write permission absent');
check(sql.includes('p_end-p_start>91'),'report date-range bound missing');
check(sql.includes('LIMIT 20')&&sql.includes('v_products')&&sql.includes('v_locations'),'database result bounding absent');
check(sql.includes('MATERIALIZED'),'POS sales cohort is not materialized for summary query');
check(sql.includes('business_pos_returns')&&sql.includes("r.status='completed'"),'returns incorrectly omitted');
check(sql.includes('LEFT JOIN public.business_pos_tax_lines'),'item VAT tax evidence missing');
check(sql.includes('estimated_item_margin_ex_vat'),'item margin estimate missing');
check(sql.includes("'is_advisory',true"),'wholesale quotes must be clearly advisory');
check(sql.includes('unit_price<=9999999999')&&sql.includes('p_price>v_product.selling_price'),'wholesale price limits missing');
check(sql.includes('CREATE POLICY wholesale_tier_member_read'),'tenant RLS policy missing');
check(sql.includes('REVOKE ALL ON public.business_wholesale_price_tiers'),'table direct writes must be revoked');
check(sql.includes('REVOKE ALL ON FUNCTION public.business_set_wholesale_price_tier'),'RPC privilege revocation missing');
check(sql.includes('v_start:=p_start::timestamp AT TIME ZONE'),'Lagos-local date interpretation missing');
check(!sql.includes('CREATE TRIGGER')&&!sql.includes('UPDATE public.orders'),'wholesale/report SQL must not mutate historical orders');
check(report.includes("requireBusinessFeature('financial_reports')"),'server report plan guard missing');
check(report.includes('business_pos_management_report'),'report must use aggregated RPC, not huge JS tables');
check(report.includes('diffDays(from,to)<=91'),'report web window limit missing');
check(!report.includes(".from('orders')")&&!report.includes(".from('payments')"),'report must not download raw transactions');
check(wholesale.includes(".limit(200)")&&wholesale.includes('truncated'),'wholesale page needs hard display limit');
check(wholesale.includes('Reference prices only'),'wholesale policy disclosure absent');
check(actions.includes("requireBusinessFeature('pos')")&&actions.includes("['owner','manager']"),'wholesale Server Action authorization missing');
check(actions.includes('business_set_wholesale_price_tier')&&actions.includes('business_delete_wholesale_price_tier'),'controlled edit RPC calls missing');
check(read('components/shell.tsx').includes('/retail-reports')&&read('components/shell.tsx').includes('/wholesale'),'menu links missing');
check(read('.github/workflows/verify.yml').includes('check:phase30m'),'CI regression missing');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')}
for(const file of ['app/(dashboard)/retail-reports/page.tsx','app/(dashboard)/wholesale/page.tsx','app/(dashboard)/wholesale/forms.tsx','app/(dashboard)/wholesale/actions.ts']){
 const f=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 check(f.parseDiagnostics.length===0,`TypeScript syntax failure in ${file}`);
}
console.log(`Phase 030M source/security/performance guards: ${assertions} checks passed. Database integration and build still required.`);
