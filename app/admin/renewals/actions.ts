'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {billingAdmin} from '@/lib/server/billing';
import {sendViaConfiguredResend} from '@/lib/notifications-email';
export type ReminderState={ok:boolean;message:string};
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function sendRenewalReminder(_prev:ReminderState,form:FormData):Promise<ReminderState>{
 const admin=await requirePlatformAdmin();
 if(!admin)return {ok:false,message:'System Owner access required.'};
 if(process.env.ENABLE_PLATFORM_EMAIL_DELIVERY!=='true'||!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)
  return {ok:false,message:'Email reminders are not enabled. Configure and verify the business email sender first.'};
 const businessId=String(form.get('business_id')||'');
 const expiry=String(form.get('expiry')||'');
 if(!validId.test(businessId)||!expiry||Number.isNaN(Date.parse(expiry)))return {ok:false,message:'Choose a valid subscription reminder.'};
 // Never trust the submitted business, recipient or plan. Resolve from the authenticated admin's permitted RPC.
 const {data,error}=await admin.client.rpc('admin_subscription_due_list');
 if(error)return {ok:false,message:'Renewals are unavailable. Check migration 050 and try again.'};
 const record=(data||[]).find((r:{business_id:string;period_ends:string;owner_user_id:string;business_name:string;plan_id:string})=>r.business_id===businessId&&new Date(r.period_ends).getTime()===new Date(expiry).getTime());
 if(!record)return {ok:false,message:'The subscription has changed or is no longer within the renewal window.'};
 try{
  const supa=billingAdmin();
  const {data:identity,error:identityError}=await supa.auth.admin.getUserById(record.owner_user_id);
  if(identityError||!identity.user?.email||!identity.user.email_confirmed_at)return {ok:false,message:'No verified account email is available for this business owner.'};
  const recipient=identity.user.email;
  const {data:reminderId,error:reserveError}=await admin.client.rpc('admin_reserve_subscription_reminder',{
   p_business:businessId,p_expiry:record.period_ends,p_recipient:recipient
  });
  if(reserveError){console.error('[renewals] reserve',reserveError.code);return {ok:false,message:'Reminder could not be prepared. Check migration 050.'};}
  if(!reminderId)return {ok:false,message:'A reminder has already been prepared for this subscription today.'};
  const dueDate=new Date(record.period_ends).toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'});
  const sent=await sendViaConfiguredResend({recipient,subject:'Your BusinessOS subscription renewal',heading:'Your subscription renewal',
   body:`Your ${record.plan_id} subscription for ${record.business_name} ends on ${dueDate}. Sign in to review your plan and renew if you would like to keep its paid features. You are not being charged by this reminder.`,buttonLabel:'View your plan',actionUrl:'/upgrade'},`bos-renewal-${reminderId}`);
  await admin.client.rpc('admin_finish_subscription_reminder',{p_id:reminderId,p_success:sent.ok,p_provider:sent.providerId||''});
  revalidatePath('/admin/renewals');
  return sent.ok?{ok:true,message:'Renewal email accepted for delivery. Check delivery logs for final status.'}:{ok:false,message:'The reminder could not be delivered. Verify your email configuration and delivery logs.'};
 }catch(e){console.error('[renewals] notification error',e instanceof Error?e.name:'unknown');return {ok:false,message:'The reminder could not be sent. Please try again later.'};}
}
