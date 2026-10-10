'use server';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {revalidatePath} from 'next/cache';
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
