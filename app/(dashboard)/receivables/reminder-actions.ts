'use server';
import {getWorkspace} from '@/lib/server/workspace';
import {sendViaConfiguredResend} from '@/lib/notifications-email';
import {money} from '@/lib/format';
export type BalanceReminderState={ok:boolean;message:string};
export async function sendBalanceReminder(_state:BalanceReminderState,form:FormData):Promise<BalanceReminderState>{
 const orderId=String(form.get('order')||'');
 if(!/^[0-9a-f-]{36}$/i.test(orderId))return {ok:false,message:'Choose a valid order.'};
 if(process.env.ENABLE_PLATFORM_EMAIL_DELIVERY!=='true'||!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)
  return {ok:false,message:'Email reminders are not enabled yet. Ask your workspace administrator for assistance.'};
 try{
  const {client,businessId,role}=await getWorkspace();
  if(!['owner','manager','finance','sales'].includes(role))return {ok:false,message:'Your role cannot send payment reminders.'};
  const {data:order,error}=await client.from('orders').select('id,order_number,total,status,customer_id,payments(amount,status)')
   .eq('business_id',businessId).eq('id',orderId).maybeSingle();
  if(error||!order||order.status==='cancelled'||!order.customer_id)return {ok:false,message:'This order is not available for reminders.'};
  const paid=(order.payments||[]).filter(p=>p.status==='completed').reduce((a,p)=>a+Number(p.amount||0),0);
  const due=Math.max(0,Number(order.total)-paid);
  if(!Number.isFinite(due)||due<=0)return {ok:false,message:'This order has no outstanding balance.'};
  const [contacts,company]=await Promise.all([
   client.from('business_customers').select('customers(name,email)').eq('business_id',businessId).eq('customer_id',order.customer_id).maybeSingle(),
   client.from('businesses').select('name').eq('id',businessId).maybeSingle()
  ]);
  const related=contacts.data?.customers;
  const c=Array.isArray(related)?related[0]:related;
  const email=c?.email;
  if(!email||!/^\S+@\S+\.\S+$/.test(email))return {ok:false,message:'Add a valid email address to the customer record before sending a reminder.'};
  if(!company.data?.name)return {ok:false,message:'The business details could not be verified.'};
  const {data:reminderId,error:reserved}=await client.rpc('business_reserve_order_reminder',{
   p_business:businessId,p_order:orderId,p_email:email
  });
  if(reserved){console.error('[customer-reminder] reserve',reserved.code);return {ok:false,message:'Could not prepare this reminder. Please try again later or contact support.'};}
  if(!reminderId)return {ok:false,message:'A reminder for this order has already been prepared today.'};
  const sent=await sendViaConfiguredResend({recipient:email,
   subject:`Payment reminder from ${company.data.name}`,
   heading:`Payment reminder from ${company.data.name}`,
   body:`Hello ${c?.name||'Customer'},\n\nOur records show a remaining balance of ${money(due)} for order ${order.order_number}. If you have already made this payment, please contact ${company.data.name} so the records can be updated.\n\nThis message does not debit your account.`,
  },`bos-order-reminder-${reminderId}`);
  await client.rpc('business_finish_order_reminder',{p_id:reminderId,p_success:sent.ok,p_provider:sent.providerId||''});
  return sent.ok?{ok:true,message:'Reminder accepted for email delivery. Check delivery records for confirmation.'}:{ok:false,message:'The email was not accepted. Check the email configuration and try later.'};
 }catch(e){console.error('[customer-reminder] send',e instanceof Error?e.name:'unknown');return {ok:false,message:'Unable to send this reminder right now.'};}
}
