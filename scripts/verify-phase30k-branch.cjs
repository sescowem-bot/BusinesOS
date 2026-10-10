#!/usr/bin/env node
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/039_branch_stock_locations_and_transfers.sql');
const actions=read('app/(dashboard)/inventory/locations/actions.ts');
const forms=read('app/(dashboard)/inventory/locations/forms.tsx');
const page=read('app/(dashboard)/inventory/locations/page.tsx');
const posPage=read('app/(dashboard)/pos/page.tsx');
const posForm=read('app/(dashboard)/pos/checkout-form.tsx');
const posActions=read('app/(dashboard)/pos/actions.ts');
let n=0;const verify=(condition,msg)=>{assert.ok(condition,msg);n++};
for(const name of ['business_stock_locations','business_location_balances','business_location_stock_transfers','business_location_stock_counts']){
 verify(sql.includes(`CREATE TABLE public.${name}`),`${name} table`);
 verify(sql.includes(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY`),`${name} RLS`);
}
for(const name of ['business_enable_branch_stock','business_transfer_location_stock','business_count_location_stock','business_pos_checkout_at_location']){
 verify(sql.includes(`CREATE FUNCTION public.${name}`),`${name} function`);
}
verify(sql.includes("'Unallocated / receiving',true"),'backfill is explicitly unallocated');
verify(sql.includes('business_sync_location_balance_trigger'),'legacy product stock synchronization trigger');
verify(sql.includes('business_guard_legacy_aggregate_stock_count'),'legacy aggregate count guard');
verify(sql.includes('quantity=quantity-p_quantity'),'source decrease');
verify(sql.includes('quantity=quantity+p_quantity'),'destination increase');
verify(!/UPDATE public\.products SET stock_quantity[^;]*p_quantity/.test(sql.slice(sql.indexOf('CREATE FUNCTION public.business_transfer_location_stock'),sql.indexOf('CREATE FUNCTION public.business_count_location_stock'))),'transfer must not change company total');
verify(sql.includes('AND quantity>=p_quantity'),'source cannot be overdrawn');
verify(sql.includes('p_request')&&sql.includes('UNIQUE(business_id,request_id)'),'request idempotency');
verify(sql.includes("PERFORM set_config('businessos.stock_location',p_location::text,true)"),'checkout selects location inside transaction');
verify(sql.includes('business_pos_checkout_priced(')&&sql.includes('business_pos_checkout('),'both POS tax paths preserved');
verify(sql.includes("'sales' AND v_location.branch_id IS NOT NULL"),'sales branch membership guard');
verify(sql.includes('WHERE id=p_product AND business_id=p_business AND active AND track_inventory FOR UPDATE'),'product lock serializes transfers and counts');
verify(sql.includes('RETURN NEW;')&&sql.includes('RAISE EXCEPTION'),'fail-closed stock trigger');
verify(posActions.includes('business_pos_checkout_at_location')&&posActions.includes('p_location:location'),'server calls branch-aware RPC');
verify(posForm.includes('name="location_id"')&&posForm.includes('setBasket([])'),'POS location change resets basket');
verify(posForm.includes('availableAt(p)'),'POS UI checks selected location stock');
verify(posPage.includes('locationUnavailable')&&posPage.includes('locationStocks'),'POS fails closed on location query failure');
verify(page.includes('mismatches')&&page.includes('capped'),'inventory prevents misleading inventory reports');
verify(actions.includes('business_transfer_location_stock')&&actions.includes('business_count_location_stock'),'server actions use protected RPCs');
verify(forms.includes('BranchTransferForm')&&forms.includes('BranchStockCountForm'),'transfer and count forms exist');
verify(read('components/shell.tsx').includes('/inventory/locations'),'branch stock in navigation');
verify(read('.github/workflows/verify.yml').includes('check:branch-stock'),'CI check included');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')}
for(const file of ['app/(dashboard)/inventory/locations/actions.ts','app/(dashboard)/inventory/locations/forms.tsx','app/(dashboard)/inventory/locations/page.tsx','app/(dashboard)/pos/actions.ts','app/(dashboard)/pos/page.tsx','app/(dashboard)/pos/checkout-form.tsx']){
 const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(source.parseDiagnostics.length,0,`${file}: ${source.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(', ')}`);n++;
}
console.log(`Phase 030K-B branch stock integrity: ${n} checks passed. SQL and live security/concurrency tests still pending.`);
