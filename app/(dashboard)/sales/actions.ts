'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {getWorkspace} from '@/lib/server/workspace';
export type ActionState={error:string;success:string};
const initialError=(e:unknown)=>e instanceof Error?e.message:'Unexpected error';
export async function createCustomer(_:ActionState,form:FormData):Promise<ActionState>{
 try{
 const {client,businessId}=await getWorkspace();const name=String(form.get('name')||'').trim(),phone=String(form.get('phone')||'').trim(),email=String(form.get('email')||'').trim();
 if(name.length<2||name.length>150||phone.length>40||email.length>254||Boolean(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return {error:'Check the name, phone and email fields.',success:''};
 const {error}=await client.rpc('crm_create_customer',{p_business:businessId,p_name:name,p_phone:phone||null,p_email:email||null});
 if(error)return {error:'Unable to create customer. Ensure migration 006 is applied.',success:''};
 revalidatePath('/customers');return {error:'',success:'Customer created successfully.'};
 }catch(e){return {error:initialError(e),success:''}}
}
export async function createOrder(_:ActionState,form:FormData):Promise<ActionState>{
 let savedOrderId:string;
 try{
  const {client,businessId,role}=await getWorkspace();
  if(!['owner','manager','finance','sales'].includes(role))return {error:'You do not have permission to create orders.',success:''};
  const customer=String(form.get('customer')||''),desc=String(form.get('description')||'').trim();
  const quantity=Number(form.get('quantity')),unitPrice=Number(form.get('unit_price'));
  const discount=Number(form.get('discount')||0),delivery=Number(form.get('delivery')||0);
  const date=String(form.get('due_date')||''),requestKey=String(form.get('request_key')||'');
  const paymentState=String(form.get('payment_state')||'unpaid');
  const paymentAmount=Number(form.get('payment_amount')||0);
  const paymentMethod=paymentState==='unpaid'?null:String(form.get('payment_method')||'');
  const paymentReference=String(form.get('payment_reference')||'').trim();
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(customer)||!uuid.test(requestKey)||desc.length<2||desc.length>200||
    ![quantity,unitPrice,discount,delivery,paymentAmount].every(Number.isFinite)||
    quantity<=0||quantity>999999||unitPrice<0||unitPrice>999999999||discount<0||delivery<0||
    discount>quantity*unitPrice||!['unpaid','partial','paid'].includes(paymentState)||
    (paymentState==='unpaid'&&paymentAmount!==0)||
    (paymentState==='partial'&&(paymentAmount<=0||Math.abs(paymentAmount-Math.round(paymentAmount*100)/100)>0.00000001))||
    (paymentState==='paid'&&paymentAmount!==0)||
    (paymentState!=='unpaid'&&!['transfer','cash','pos','card','other'].includes(paymentMethod||''))||
    paymentReference.length>150||Boolean(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))
   return {error:'Check your order details and the payment amount before saving.',success:''};
  const {data,error}=await client.rpc('crm_create_order_with_initial_payment',{
   p_business:businessId,p_customer:customer,p_request_key:requestKey,p_mode:'manual',
   p_description:desc,p_supply:null,p_quantity:quantity,p_unit_price:unitPrice,
   p_discount:discount,p_delivery:delivery,p_due_date:date||null,
   p_payment_state:paymentState,p_payment_amount:paymentAmount,
   p_payment_method:paymentMethod,p_payment_reference:paymentReference||null
  });
  if(error)return {error:error.code==='42883'||error.code==='PGRST202'?
   'Order payments on creation require SQL migration 036. Ask the System Owner to install it.':
   'Order was not created. Check payment amount, customer, business access or reviewed VAT requirements.',success:''};
  if(!data)return {error:'The saved order could not be confirmed. Check Orders before retrying.',success:''};
  savedOrderId=String(data);
  revalidatePath('/orders');revalidatePath('/payments');revalidatePath('/customers');revalidatePath('/dashboard');
 }catch{return {error:'Could not create this order. Please retry. Your payment was not recorded by this action.',success:''};}
 redirect(`/orders/${savedOrderId}?created=1`);
}
export async function recordPayment(_:ActionState,form:FormData):Promise<ActionState>{
 try{
 const {client,businessId}=await getWorkspace();const order=String(form.get('order')||''),amount=Number(form.get('amount')),method=String(form.get('method')||''),reference=String(form.get('reference')||'').trim();
 if(!order||!Number.isFinite(amount)||amount<=0||!['cash','transfer','pos','card','other'].includes(method)||reference.length>150)return {error:'Enter a valid amount and payment method.',success:''};
 const {error}=await client.rpc('crm_record_payment',{p_business:businessId,p_order:order,p_amount:amount,p_method:method,p_reference:reference||null});
 if(error)return {error:'Unable to save payment. Confirm the remaining balance and migration 006.',success:''};
 revalidatePath('/orders');revalidatePath('/customers');revalidatePath(`/orders/${order}`);return {error:'',success:'Payment recorded successfully.'};
 }catch(e){return {error:initialError(e),success:''}}
}
