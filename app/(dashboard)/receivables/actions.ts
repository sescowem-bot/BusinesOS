'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export type PaymentPlanState={ok:boolean;message:string};
export async function saveInstallmentPlan(_state:PaymentPlanState,form:FormData):Promise<PaymentPlanState>{
 const order=String(form.get('order')||'');
 const count=Number(form.get('count'));
 const interval=Number(form.get('interval'));
 const due=String(form.get('due')||'');
 const note=String(form.get('note')||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(order)||!Number.isInteger(count)||count<2||count>24||!Number.isInteger(interval)||interval<7||interval>90||!/^\d{4}-\d{2}-\d{2}$/.test(due)||note.length>600)
  return {ok:false,message:'Check the number of instalments and first payment date.'};
 try{
  const {client,businessId,role}=await getWorkspace();
  if(!['owner','manager','finance','sales'].includes(role))return {ok:false,message:'Only authorised sales or finance team members can arrange instalments.'};
  const {error}=await client.rpc('business_save_order_installments',{p_business:businessId,p_order:order,p_count:count,p_first:due,p_interval:interval,p_note:note});
  if(error){console.error('[installment] save',error.code);return {ok:false,message:'The arrangement could not be saved. Please check the order balance and selected dates.'};}
  revalidatePath('/receivables');revalidatePath(`/orders/${order}`);
  return {ok:true,message:'Instalment arrangement saved. Record actual payments on the order when money is received.'};
 }catch{return {ok:false,message:'Could not save this arrangement. Please try again.'};}
}
