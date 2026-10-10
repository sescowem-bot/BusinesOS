'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
export type PurchaseState={ok:boolean;message:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(message:string):PurchaseState=>({ok:false,message});
const refresh=()=>{revalidatePath('/purchasing');revalidatePath('/inventory');revalidatePath('/products')};
export async function createSupplier(_:PurchaseState,fd:FormData):Promise<PurchaseState>{
 try{const access=await requireBusinessFeature('purchasing');if(!access.allowed)return fail(access.reason);
 if(!['owner','manager','inventory'].includes(access.role))return fail('Purchasing role required.');
 const name=String(fd.get('name')||'').trim(),contact=String(fd.get('contact')||'').trim(),phone=String(fd.get('phone')||'').trim(),email=String(fd.get('email')||'').trim(),notes=String(fd.get('notes')||'').trim();
 if(name.length<2||name.length>160||contact.length>160||phone.length>50||email.length>254||notes.length>500||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return fail('Check supplier details.');
 const {error}=await access.client.rpc('business_create_supplier',{p_business:access.businessId,p_name:name,p_contact:contact,p_phone:phone,p_email:email,p_notes:notes});
 if(error)return fail('Supplier could not be saved: '+error.message);refresh();return {ok:true,message:'Supplier added. Refresh the page to create a purchase order.'};
 }catch{return fail('Could not create supplier.');}
}
export async function createPurchase(_:PurchaseState,fd:FormData):Promise<PurchaseState>{
 try{const access=await requireBusinessFeature('purchasing');if(!access.allowed)return fail(access.reason);
 if(!['owner','manager','inventory'].includes(access.role))return fail('Purchasing role required.');
 const supplier=String(fd.get('supplier')||''),notes=String(fd.get('notes')||'').trim(),raw=String(fd.get('lines')||'');
 if(!UUID.test(supplier)||notes.length>500||raw.length>12000)return fail('Invalid purchase details.');
 const lines:unknown=JSON.parse(raw);
 if(!Array.isArray(lines)||lines.length<1||lines.length>30||lines.some(x=>!x||typeof x!=='object'||typeof x.product_id!=='string'||!UUID.test(x.product_id)||typeof x.quantity!=='number'||!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>1000000||Math.abs(Math.round(x.quantity*1000)-x.quantity*1000)>1e-6||typeof x.unit_cost!=='number'||!Number.isFinite(x.unit_cost)||x.unit_cost<0||x.unit_cost>999999999||Math.abs(Math.round(x.unit_cost*100)-x.unit_cost*100)>1e-6)||new Set(lines.map(x=>x.product_id)).size!==lines.length)return fail('Choose 1–30 distinct tracked products with valid quantities and costs.');
 const {error}=await access.client.rpc('business_create_purchase',{p_business:access.businessId,p_supplier:supplier,p_items:lines,p_notes:notes});
 if(error)return fail('Purchase order could not be created: '+error.message);
 refresh();return {ok:true,message:'Draft purchase order created. Stock will increase only after receipt is confirmed.'};
 }catch{return fail('Could not create purchase order.');}
}
export async function receivePurchase(_:PurchaseState,fd:FormData):Promise<PurchaseState>{
 try{
  const access=await requireBusinessFeature('purchasing');if(!access.allowed)return fail(access.reason);
  const inventory=await requireBusinessFeature('inventory');if(!inventory.allowed)return fail('Inventory permission is also required to receive stock.');
  if(!['owner','manager','inventory'].includes(access.role))return fail('Purchasing role required.');
  if(fd.get('confirmed')!=='yes')return fail('Confirm that the goods and quantities were physically checked.');
  const id=String(fd.get('purchase')||'');if(!UUID.test(id))return fail('Invalid purchase identifier.');
  const {error}=await access.client.rpc('business_receive_purchase',{p_business:access.businessId,p_purchase:id});
  if(error)return fail('Goods receipt was not saved: '+error.message);
  refresh();return {ok:true,message:'Goods receipt confirmed. Inventory quantities and stock movements have been updated.'};
 }catch{return fail('Unable to receive goods. Reload and retry after checking the draft.');}
}

// 030K: partial goods receipts and evidenced supplier billing.
const positiveQuantity=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1000000&&Math.abs(Math.round(n*1000)-n*1000)<1e-6;
const amountValue=(n:string)=>{const v=Number(n);return /^\d+(?:\.\d{1,2})?$/.test(n)&&Number.isFinite(v)&&v>0&&v<=99999999999.99?v:null};
export async function receivePurchasePartial(_:PurchaseState,fd:FormData):Promise<PurchaseState>{
 try{
  const access=await requireBusinessFeature('purchasing');if(!access.allowed)return fail(access.reason);
  const stock=await requireBusinessFeature('inventory');if(!stock.allowed)return fail('Inventory access is required to receive goods.');
  if(!['owner','manager','inventory'].includes(access.role))return fail('Purchasing and inventory role required.');
  if(fd.get('confirmed')!=='yes')return fail('Confirm that the quantities were physically checked.');
  const purchase=String(fd.get('purchase')||''),request=String(fd.get('request')||''),note=String(fd.get('note')||'').trim(),raw=String(fd.get('lines')||'');
  if(!UUID.test(purchase)||!UUID.test(request)||note.length>500||raw.length>6000)return fail('Invalid receipt. Reload the purchase order.');
  const lines:unknown=JSON.parse(raw);
  if(!Array.isArray(lines)||lines.length<1||lines.length>30||lines.some(l=>!l||typeof l!=='object'||!UUID.test(l.purchase_item_id)||!positiveQuantity(l.quantity))||new Set(lines.map(l=>l.purchase_item_id)).size!==lines.length)return fail('Choose valid outstanding quantities for up to 30 items.');
  const {error}=await access.client.rpc('business_receive_purchase_partial',{p_business:access.businessId,p_purchase:purchase,p_request:request,p_lines:lines,p_note:note});
  if(error)return fail('Goods receipt could not be completed: '+error.message);
  refresh();return {ok:true,message:'Partial goods receipt recorded. Reload this page to see the new outstanding quantities.'};
 }catch{return fail('Could not receive goods. Check quantities and retry.');}
}
export async function recordSupplierBill(_:PurchaseState,fd:FormData):Promise<PurchaseState>{
 try{
  const a=await requireBusinessFeature('purchasing');if(!a.allowed)return fail(a.reason);
  if(!['owner','manager'].includes(a.role))return fail('Only the business owner or manager can register supplier bills.');
  const purchase=String(fd.get('purchase')||''),reference=String(fd.get('reference')||'').trim(),amount=amountValue(String(fd.get('amount')||'')),issued=String(fd.get('issued')||''),due=String(fd.get('due')||''),note=String(fd.get('note')||'').trim();
  if(!UUID.test(purchase)||!reference||reference.length>100||amount===null||!/^\d{4}-\d{2}-\d{2}$/.test(issued)||(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))||note.length>500||Boolean(due&&due<issued))return fail('Enter a valid supplier invoice amount, reference and dates.');
  const {error}=await a.client.rpc('business_record_supplier_bill',{p_business:a.businessId,p_purchase:purchase,p_reference:reference,p_amount:amount,p_issued:issued,p_due:due||null,p_note:note});
  if(error)return fail('Supplier invoice could not be saved: '+error.message);
  refresh();return {ok:true,message:'Supplier bill registered. This is a manually entered supplier invoice, not an accounting journal.'};
 }catch{return fail('Supplier invoice could not be registered.');}
}
export async function recordSupplierPayment(_:PurchaseState,fd:FormData):Promise<PurchaseState>{
 try{
  const a=await requireBusinessFeature('purchasing');if(!a.allowed)return fail(a.reason);
  if(!['owner','manager'].includes(a.role))return fail('Only owners or managers can record supplier payments.');
  const bill=String(fd.get('bill')||''),request=String(fd.get('request')||''),amount=amountValue(String(fd.get('amount')||'')),method=String(fd.get('method')||''),reference=String(fd.get('reference')||'').trim(),paid=String(fd.get('paid')||'');
  if(!UUID.test(bill)||!UUID.test(request)||amount===null||!['cash','transfer','external_pos','other'].includes(method)||reference.length<3||reference.length>150||!/^\d{4}-\d{2}-\d{2}$/.test(paid))return fail('Enter a valid confirmed payment and reference.');
  const {error}=await a.client.rpc('business_record_supplier_payment',{p_business:a.businessId,p_bill:bill,p_request:request,p_amount:amount,p_method:method,p_reference:reference,p_paid_on:paid});
  if(error)return fail('Supplier payment could not be recorded: '+error.message);
  refresh();return {ok:true,message:'External supplier payment recorded. This does not transfer funds or create a GL journal.'};
 }catch{return fail('Supplier payment could not be saved.');}
}
