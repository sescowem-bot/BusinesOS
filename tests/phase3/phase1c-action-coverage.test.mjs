import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const root='app/(dashboard)/';
function actionBody(file,name){
 const s=read(root+file);
 const start=s.indexOf('export async function '+name+'(');
 assert.ok(start>=0,'Function not found: '+file+' '+name);
 const next=s.indexOf('export async function ',start+1);
 return s.slice(start,next>=0?next:undefined);
}
function guardBeforeRpc(file,name,guard,call){
 const body=actionBody(file,name);
 const a=body.indexOf(guard),b=body.indexOf(call);
 assert.ok(a>=0,file+': missing '+guard+' in '+name);
 assert.ok(b>=0,file+': missing RPC '+call+' in '+name);
 assert.ok(a<b,file+': guard must precede RPC in '+name);
}
test('premium action helper verifies direct database action decision fail closed',()=>{
 const source=read('lib/server/core-action-permissions.ts');
 assert.match(source,/export async function premiumActionAllowed/);
 assert.match(source,/business_can_perform_action/);
 assert.match(source,/!error&&data===true/);
});
test('VAT-reviewed orders have the same core order and initial-payment permission gates as ordinary orders',()=>{
 guardBeforeRpc('orders/new/reviewed-tax-actions.ts','createReviewedTaxOrder', "coreActionAllowed(access,'orders','create')","rpc('crm_create_order_with_cost'");
 const source=actionBody('orders/new/reviewed-tax-actions.ts','createReviewedTaxOrder');
 assert.match(source,/paymentState==='partial'\?coreActionAllowed\(access,'payments','create'\)/);
});
test('catalog products and inventory updates enforce separate core and premium actions',()=>{
 guardBeforeRpc('catalog/actions.ts','addCatalogItem',"coreActionAllowed(access,'products','create')","rpc('catalog_create_item'");
 guardBeforeRpc('catalog/actions.ts','addCatalogItem',"premiumActionAllowed(inventory,'inventory','create')","rpc('catalog_create_item'");
 guardBeforeRpc('catalog/actions.ts','adjustStock',"premiumActionAllowed(access,'inventory','edit')","rpc('inventory_adjust_stock'");
 guardBeforeRpc('catalog/actions.ts','recordStockCount',"premiumActionAllowed(access,'inventory','edit')","rpc('inventory_record_stock_count'");
 for(const file of ['products/page.tsx','products/new/page.tsx'])assert.match(read(root+file),/coreActionAllowed/);
 assert.match(read(root+'products/new/page.tsx'),/redirect\('/);
});
const guarded=[
 ['pos/actions.ts','submitCheckout',"premiumActionAllowed(access,'pos','create')","rpc(operation"],
 ['pos/held-actions.ts','savePosCart',"premiumActionAllowed(access,'pos','create')","rpc('business_save_pos_cart'"],
 ['pos/held-actions.ts','discardPosCart',"premiumActionAllowed(access,'pos','delete')","rpc('business_delete_pos_cart'"],
 ['pos/shift-actions.ts','openCashierShift',"premiumActionAllowed(access,'pos','create')","rpc('business_open_pos_shift'"],
 ['pos/shift-actions.ts','recordCashMovement',"premiumActionAllowed(access,'pos','edit')","rpc('business_add_pos_cash_movement'"],
 ['pos/shift-actions.ts','closeCashierShift',"premiumActionAllowed(access,'pos','edit')","rpc('business_close_pos_shift'"],
 ['pos/shift-actions.ts','reviewCashierShift',"premiumActionAllowed(access,'pos','approve')","rpc('business_review_pos_shift'"],
 ['returns/actions.ts','requestPosReturn',"premiumActionAllowed(access,'pos','create')","rpc('business_request_pos_return'"],
 ['returns/actions.ts','reviewPosReturn',"premiumActionAllowed(access,'pos','approve')","rpc('business_review_pos_return'"],
 ['returns/actions.ts','completePosReturn',"premiumActionAllowed(access,'pos','approve')","rpc('business_complete_pos_return'"],
 ['pos/tax-mapping/actions.ts','savePosTaxMapping',"premiumActionAllowed(access,'pos','edit')","rpc('business_set_product_tax_mapping'"],
 ['purchasing/actions.ts','createSupplier',"premiumActionAllowed(access,'purchasing','create')","rpc('business_create_supplier'"],
 ['purchasing/actions.ts','createPurchase',"premiumActionAllowed(access,'purchasing','create')","rpc('business_create_purchase'"],
 ['purchasing/actions.ts','receivePurchase',"premiumActionAllowed(access,'purchasing','edit')","rpc('business_receive_purchase'"],
 ['purchasing/actions.ts','receivePurchasePartial',"premiumActionAllowed(access,'purchasing','edit')","rpc('business_receive_purchase_partial'"],
 ['purchasing/actions.ts','recordSupplierBill',"premiumActionAllowed(a,'purchasing','create')","rpc('business_record_supplier_bill'"],
 ['purchasing/actions.ts','recordSupplierPayment',"premiumActionAllowed(a,'purchasing','edit')","rpc('business_record_supplier_payment'"],
 ['inventory/locations/actions.ts','enableBranchLocation',"premiumActionAllowed(a,'inventory','edit')","rpc('business_enable_branch_stock'"],
 ['inventory/locations/actions.ts','transferBranchStock',"premiumActionAllowed(a,'inventory','edit')","rpc('business_transfer_location_stock'"],
 ['inventory/locations/actions.ts','countBranchStock',"premiumActionAllowed(a,'inventory','edit')","rpc('business_count_location_stock'"],
 ['accounting/actions.ts','createAccount',"premiumActionAllowed(access,'accounting','create')","rpc('gl_add_account'"],
 ['accounting/actions.ts','createPeriod',"premiumActionAllowed(access,'accounting','create')","rpc('gl_create_period'"],
 ['accounting/actions.ts','postJournal',"premiumActionAllowed(access,'accounting','create')","rpc('gl_post_journal'"],
 ['accounting/integration-actions.ts','configureAccounting',"premiumActionAllowed(access,'accounting','edit')","rpc('gl_configure_integration'"],
 ['accounting/integration-actions.ts','discoverAccountingSources',"premiumActionAllowed(access,'accounting','create')","rpc('gl_discover_existing_sources'"],
 ['accounting/integration-actions.ts','processAccountingSources',"premiumActionAllowed(access,'accounting','approve')","rpc('gl_process_accounting_queue'"]
];
test('premium writer paths require configured plan-action checks before invocation',()=>{
 for(const [file,name,guard,rpc] of guarded)guardBeforeRpc(file,name,guard,rpc);
});
test('POS payments and refund completion verify core payment capability',()=>{
 guardBeforeRpc('pos/actions.ts','submitCheckout',"coreActionAllowed(access,'payments','create')","rpc(operation");
 guardBeforeRpc('returns/actions.ts','completePosReturn',"coreActionAllowed(access,'payments','edit')","rpc('business_complete_pos_return'");
});
test('stock receipts verify purchasing and inventory privileges before stock changes',()=>{
 guardBeforeRpc('purchasing/actions.ts','receivePurchase',"premiumActionAllowed(inventory,'inventory','edit')","rpc('business_receive_purchase'");
 guardBeforeRpc('purchasing/actions.ts','receivePurchasePartial',"premiumActionAllowed(stock,'inventory','edit')","rpc('business_receive_purchase_partial'");
});
test('System Owner page states actual action enforcement flag without claiming staged settings are enforced',()=>{
 const page=read('app/admin/plan-actions/page.tsx');
 assert.match(page,/platform_plan_action_enforcement/);
 assert.match(page,/global database action-enforcement switch is OFF/);
 assert.match(page,/action-enforcement switch/);
});
