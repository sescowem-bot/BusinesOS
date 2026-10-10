// Source/invariant checks only. Integration tests require staging Supabase + Vercel.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const sql=read('supabase/migrations/027_inventory_counts_security.sql');
for(const fragment of [
 'BEGIN;','COMMIT;','CREATE TABLE public.inventory_stock_counts',
 'CREATE POLICY inventory_stock_counts_access','ENABLE ROW LEVEL SECURITY',
 'CREATE FUNCTION public.inventory_record_stock_count','CREATE OR REPLACE FUNCTION public.inventory_adjust_stock',
 "public.business_has_feature(p_business,'inventory')",'FOR UPDATE',
 'v_actual IS DISTINCT FROM p_expected','stock_quantity=p_counted',
 'INSERT INTO public.inventory_movements','REVOKE ALL ON public.inventory_stock_counts',
 'GRANT SELECT ON public.inventory_stock_counts',
 'GRANT EXECUTE ON FUNCTION public.inventory_record_stock_count'
])assert(sql.includes(fragment),`Migration missing expected invariant: ${fragment}`);
assert(!/DROP\s+(TABLE|SCHEMA)/i.test(sql),'Do not drop data');
assert(!/UPDATE\s+public\.products\s+SET\s+stock_quantity\s*=\s*0/i.test(sql),'Do not reset inventory');
const actions=read('app/(dashboard)/catalog/actions.ts');
assert(actions.includes('recordStockCount')&&actions.includes("requireBusinessFeature('inventory')"));
assert(actions.includes("['owner','manager','inventory'].includes(access.role)"),'Inventory mutations need role validation');
const inv=read('app/(dashboard)/inventory/page.tsx');
assert(inv.includes('inventory_stock_counts'),'Count audit must be shown');
assert(inv.includes('StockCountForm'),'Physical count input must be available');
assert(inv.includes('countResult.error'),'Migration failure must be surfaced');
const rec=read('app/(dashboard)/accounting/reconciliation/page.tsx');
assert(rec.includes("requireBusinessFeature('accounting')"),'Account reconciliation is a premium feature');
assert(rec.includes("['owner','manager','finance']"),'Financial roles required');
assert(rec.includes("count:'exact'"),'Query count must not use only displayed rows');
assert(rec.includes('not a bank statement reconciliation'),'Avoid unsupported certification');
const profile=read('app/(dashboard)/tax-profile/page.tsx');
assert(profile.includes('getWorkspace()'),'Tax profile must use selected business context');
assert(!profile.includes(".from('business_members')"),'Tax profile must not bypass selected workspace by querying oldest membership');
const taxActions=read('app/(dashboard)/tax-profile/actions.ts');
assert(taxActions.includes('getWorkspace()')&&taxActions.includes('activeBusiness!==businessId')&&taxActions.includes('activeBusiness!==id'),'Tax writes must match selected business context');
const tax=read('app/(dashboard)/tax-centre/page.tsx');
for(const guard of ['effective_from','effective_to','rate_basis_points','applicable.length===1','needs_review'])assert(tax.includes(guard),`Missing tax guard: ${guard}`);
const remaining=fs.readdirSync(root).filter(file=>file.endsWith('.md')&&file!=='README.md');
assert.equal(remaining.length,0,`Markdown files at root: ${remaining.join(', ')}`);
assert(fs.existsSync(path.join(root,'MD','PHASE_027_RELEASE_NOTES.md')));
console.log('Phase 027 structural invariants passed. Live SQL, RLS, inventory and accounting reconciliation tests remain outstanding.');
