'use server';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {revalidatePath} from 'next/cache';
export type EmailTestResult={error:string;success:string};
export async function savePlatformEmailTemplate(form:FormData){
 const session=await requirePlatformAdmin();if(!session)throw new Error('Administrator access required');
 const templateKey=String(form.get('template_key')||'');
 const subject=String(form.get('subject')||'').trim();
 const heading=String(form.get('heading')||'').trim();
 const bodyText=String(form.get('body_text')||'').trim();
 const buttonLabel=String(form.get('button_label')||'').trim();
 if(!/^[a-z][a-z0-9_]{1,70}$/.test(templateKey)||!subject||subject.length>200||heading.length>200||bodyText.length>10000||buttonLabel.length>100)throw new Error('Please correct template fields.');
 const {error}=await session.client.from('platform_email_templates').upsert({template_key:templateKey,subject,heading,body_text:bodyText,button_label:buttonLabel,enabled:form.get('enabled')==='on',updated_by:session.user.id,updated_at:new Date().toISOString()},{onConflict:'template_key'});
 if(error)throw new Error('Unable to save email template. Check migration 020 and your administrator permissions.');
 revalidatePath('/admin/email');
}

/** Live admin test. Sends ONLY to the authenticated System Owner's own address. */
export async function sendAdminTestEmail(_:EmailTestResult,form:FormData):Promise<EmailTestResult>{
 try{
  const session=await requirePlatformAdmin();
  if(!session||!session.user.email)return {error:'System Owner sign-in with an email address is required.',success:''};
  const templateKey=String(form.get('template_key')||'');
  if(!/^[a-z][a-z0-9_]{1,70}$/.test(templateKey))return {error:'Unknown email template.',success:''};
  if(process.env.ENABLE_PLATFORM_EMAIL_DELIVERY!=='true')return {error:'Test sending is disabled. Configure the verified sender and delivery flag first.',success:''};
  const {data:template,error:templateError}=await session.client.from('platform_email_templates')
   .select('subject,heading,body_text,button_label,enabled').eq('template_key',templateKey).maybeSingle();
  if(templateError||!template)return {error:'Template unavailable. Check email settings and migration 020.',success:''};
  if(!template.enabled)return {error:'This email template is disabled.',success:''};
  const {data:logId,error:queueError}=await session.client.rpc('admin_begin_email_test',{p_template_key:templateKey});
  if(queueError||typeof logId!=='string')return {error:queueError?.message||'Could not queue test. Confirm migration 025.',success:''};
  const {sendViaConfiguredResend}=await import('@/lib/notifications-email');
  const {getPlatformBrand}=await import('@/lib/server/branding');
  const brand=await getPlatformBrand();
  const apply=(value:string)=>value.replace(/\{\{platform_name\}\}/g,brand.name).replace(/\{\{support_email\}\}/g,brand.support_email||'the support team');
  const result=await sendViaConfiguredResend({
   recipient:session.user.email,subject:apply(template.subject),
   heading:apply(template.heading),body:apply(template.body_text),
   buttonLabel:apply(template.button_label),actionUrl:'/admin/email'
  },logId);
  const {error:finishError}=await session.client.rpc('admin_finish_email_test',{
   p_id:logId,p_success:result.ok,p_provider_message_id:result.providerId||null,p_error_code:result.error||null
  });
  if(finishError)return {error:'The email attempt may have succeeded, but its log could not be updated. Review Resend before retrying.',success:''};
  revalidatePath('/admin/email');
  if(!result.ok)return {error:`Email could not be delivered to Resend: ${result.error||'provider unavailable'}.`,success:''};
  return {error:'',success:'Resend accepted the test message. Check your mailbox and the delivery log for the final status.'};
 }catch{return {error:'Unable to complete the email test. Check server configuration and try later.',success:''};}
}
