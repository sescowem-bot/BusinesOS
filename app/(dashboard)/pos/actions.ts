'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
export type CheckoutState={ok:boolean;message:string;orderId?:string};
const failed=(message:string):CheckoutState=>({ok:false,message});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function submitCheckout(_:CheckoutState,fd:FormData):Promise<CheckoutState>{
 try{
  const access=await requireBusinessFeature('pos');if(!access.allowed)return failed(access.reason);
  if(!['owner','manager','sales'].includes(access.role))return failed('A sales, manager or owner role is required to check out.');
  const request=String(fd.get('request_id')||''),customer=String(fd.get('customer')||''),reference=String(fd.get('reference')||'').trim();
  const location=String(fd.get('location_id')||'');
  const paid=fd.get('paid')==='yes',method=String(fd.get('method')||'cash');
  const priceMode=String(fd.get('price_mode')||'exclusive');
  const discountRaw=String(fd.get('discount')||'0');
  const discount=Number(discountRaw);
  if(!['exclusive','inclusive'].includes(priceMode)||!/^\d{1,12}(?:\.\d{1,2})?$/.test(discountRaw)||!Number.isFinite(discount)||discount<0)return failed('Enter a valid pre-tax discount (up to two decimal places).');
  if(!UUID.test(location)||!UUID.test(request)||(customer&&!UUID.test(customer))||reference.length>150||!['cash','transfer','pos','card','other'].includes(method))return failed('Check the checkout details.');
  const raw=String(fd.get('basket')||'');if(raw.length>12000)return failed('Basket is too large.');
  const lines:unknown=JSON.parse(raw);
  if(!Array.isArray(lines)||lines.length<1||lines.length>30||lines.some(x=>!x||typeof x!=='object'||typeof x.product_id!=='string'||!UUID.test(x.product_id)||typeof x.quantity!=='number'||!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>1000000||Math.abs(Math.round(x.quantity*1000)-x.quantity*1000)>1e-6)||new Set(lines.map(x=>x.product_id)).size!==lines.length) return failed('Choose 1–30 distinct items with valid quantities.');
  // Never trust the form to decide if a business may skip reviewed VAT.
  const {data:profile,error:profileError}=await access.client.from('business_tax_profiles')
   .select('vat_registration_status,classification_status').eq('business_id',access.businessId).maybeSingle();
  if(profileError)return failed('Business tax status cannot be verified. Checkout has been stopped.');
  const vatRegistered=profile?.vat_registration_status==='registered';
  if(vatRegistered&&profile?.classification_status!=='reviewed')return failed('VAT registration needs tax review before POS can proceed. Open Tax Centre.');
  if(!vatRegistered&&(priceMode!=='exclusive'||discount!==0))return failed('Tax-inclusive pricing and discounts require a reviewed VAT business profile.');
  const tenderRaw=String(fd.get('tenders')||'');
  const split=fd.get('payment_mode')==='split';
  let tenders:{method:string;amount:number;reference:string}[]=[];
  if(split){
   if(tenderRaw.length>2500)return failed('Split tender details are too long.');
   const parsed:unknown=JSON.parse(tenderRaw);
   if(!Array.isArray(parsed)||parsed.length<2||parsed.length>3)return failed('Select two or three recorded payment methods.');
   for(const item of parsed){
    if(!item||typeof item!=='object')return failed('Invalid split tender.');
    const v=item as {method?:unknown;amount?:unknown;reference?:unknown};
    if(typeof v.method!=='string'||!['cash','transfer','pos','card','other'].includes(v.method)||
      typeof v.amount!=='number'||!Number.isFinite(v.amount)||v.amount<=0||v.amount>999999999||
      Math.abs(Math.round(v.amount*100)-v.amount*100)>1e-6||typeof v.reference!=='string'||v.reference.length>150)
      return failed('Check the split payment methods and amounts.');
    tenders.push({method:v.method,amount:v.amount,reference:v.reference});
   }
  }
  const operation=split?'business_pos_checkout_split':'business_pos_checkout_at_location';
  const options:Record<string,unknown>={p_business:access.businessId,p_request:request,p_customer:customer||null,p_items:lines,p_paid:paid,p_method:method,p_reference:reference||null,p_location:location,p_price_mode:vatRegistered?priceMode:null,p_discount:vatRegistered?discount:0};
  
  if(split){
   if(!paid)return failed('To record split tenders, select payment received.');
   const sum=tenders.reduce((n,t)=>n+Math.round(t.amount*100),0)/100;
   if(sum<=0)return failed('Enter amounts received.');
  }
  const rpcOptions=split?{
   p_business:access.businessId,p_request:request,p_customer:customer||null,p_items:lines,
   p_tenders:tenders,p_price_mode:priceMode,p_discount:vatRegistered?discount:0,p_location:location
  }:options;
  const {data,error}=await access.client.rpc(operation,rpcOptions);
  if(error)return failed(error.code==='42501'?'POS access is not enabled for this business and role.':error.code==='42883'||error.code==='PGRST202'?'POS checkout function is unavailable. Apply SQL 039 and SQL 040 in order before proceeding.':`Sale was not completed: ${error.message}`);
  revalidatePath('/pos');revalidatePath('/orders');revalidatePath('/payments');revalidatePath('/products');revalidatePath('/inventory');
  return {ok:true,message:split?'Sale and split recorded tenders saved in one transaction. No bank or card was charged.':paid?'Sale and recorded payment saved. This does not charge a bank card.':'Sale saved as unpaid. Stock has been deducted for tracked items.',orderId:String(data)};
 }catch{return failed('Checkout could not be saved. Check your basket or reload before trying again.');}
}
