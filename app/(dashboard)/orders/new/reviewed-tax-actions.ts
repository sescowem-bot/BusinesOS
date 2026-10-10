'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
export type ReviewedTaxState={error:string;success:string};
export async function createReviewedTaxOrder(_:ReviewedTaxState,form:FormData):Promise<ReviewedTaxState>{
 let savedOrderId:string;
 try{
  const customer=String(form.get('customer')||''),supply=String(form.get('tax_supply_id')||'');
  const quantity=Number(form.get('quantity')),price=Number(form.get('unit_price'));
  const discount=Number(form.get('discount')||0),dueDate=String(form.get('due_date')||'');
  const requestKey=String(form.get('request_key')||'');
  const paymentState=String(form.get('payment_state')||'unpaid');
  const paymentAmount=Number(form.get('payment_amount')||0);
  const paymentMethod=paymentState==='unpaid'?null:String(form.get('payment_method')||'');
  const paymentReference=String(form.get('payment_reference')||'').trim();
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(customer)||!uuid.test(supply)||!uuid.test(requestKey)||
   ![quantity,price,discount,paymentAmount].every(Number.isFinite)||
   quantity<=0||quantity>999999||price<0||price>999999999||discount<0||discount>quantity*price||
   !['unpaid','partial','paid'].includes(paymentState)||
   (paymentState==='unpaid'&&paymentAmount!==0)||
   (paymentState==='paid'&&paymentAmount!==0)||
   (paymentState==='partial'&&(paymentAmount<=0||Math.abs(paymentAmount-Math.round(paymentAmount*100)/100)>0.00000001))||
   (paymentState!=='unpaid'&&!['cash','transfer','pos','card','other'].includes(paymentMethod||''))||
   paymentReference.length>150||Boolean(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)))
   return {error:'Select an approved supply and check the order and initial payment details.',success:''};
  const {client,businessId,role}=await getWorkspace();
  if(!['owner','manager','finance','sales'].includes(role))return {error:'Not authorised to create orders.',success:''};
  const {data,error}=await client.rpc('crm_create_order_with_initial_payment',{
   p_business:businessId,p_customer:customer,p_request_key:requestKey,p_mode:'reviewed',
   p_description:null,p_supply:supply,p_quantity:quantity,p_unit_price:price,
   p_discount:discount,p_delivery:0,p_due_date:dueDate||null,
   p_payment_state:paymentState,p_payment_amount:paymentAmount,
   p_payment_method:paymentMethod,p_payment_reference:paymentReference||null
  });
  if(error)return {error:error.code==='42883'||error.code==='PGRST202'?
   'Apply SQL 036 to enable creating a reviewed order with its payment.':
   'Order not saved. Verify the VAT profile, approved classification, payment details and total.',success:''};
  if(!data)return {error:'Order could not be confirmed. Check Orders before retrying.',success:''};
  savedOrderId=String(data);
  revalidatePath('/orders');revalidatePath('/payments');revalidatePath('/invoices');revalidatePath('/dashboard');
 }catch{return {error:'Could not save this order. Please retry after checking your connection.',success:''};}
 redirect(`/orders/${savedOrderId}?created=1`);
}
