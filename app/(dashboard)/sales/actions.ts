'use server';
import {revalidatePath} from 'next/cache';
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
 try{
 const {client,businessId}=await getWorkspace();const customer=String(form.get('customer')||''),desc=String(form.get('description')||'').trim();
 const quantity=Number(form.get('quantity')),unitPrice=Number(form.get('unit_price')),discount=Number(form.get('discount')||0),delivery=Number(form.get('delivery')||0),date=String(form.get('due_date')||'');
 if(!customer||!desc||desc.length>200||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitPrice)||unitPrice<0||![discount,delivery].every(v=>Number.isFinite(v)&&v>=0)||discount>quantity*unitPrice)return {error:'Enter valid order details and select a customer.',success:''};
 const {error}=await client.rpc('crm_create_order',{p_business:businessId,p_customer:customer,p_description:desc,p_quantity:quantity,p_unit_price:unitPrice,p_discount:discount,p_delivery:delivery,p_due_date:date||null});
 if(error)return {error:'Order could not be saved. Check its values and database migration 006.',success:''};
 revalidatePath('/orders');return {error:'',success:'Order created. VAT is not charged until classification rules are approved.'};
 }catch(e){return {error:initialError(e),success:''}}
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
