'use server';
import {revalidatePath} from 'next/cache';
import {getServerSupabase} from '@/lib/server/supabase';
export async function updateNotificationRead(form:FormData){
 const client=await getServerSupabase();if(!client)return;
 const {data:{user}}=await client.auth.getUser();if(!user)return;
 const id=String(form.get('id')||'');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return;
 const {error}=await client.rpc('set_notification_read',{p_id:id,p_read:String(form.get('read'))!=='false'});
 if(error)throw new Error('Could not update notification.');
 revalidatePath('/notifications');
}
export async function updateNotificationPreferences(form:FormData){
 const client=await getServerSupabase();if(!client)return;
 const {data:{user}}=await client.auth.getUser();if(!user)return;
 const {error}=await client.from('notification_preferences').upsert({user_id:user.id,email_business:form.get('email_business')==='on',email_marketing:form.get('email_marketing')==='on',in_app_business:form.get('in_app_business')==='on',updated_at:new Date().toISOString()},{onConflict:'user_id'});
 if(error)throw new Error('Could not save notification preferences.');
 revalidatePath('/notifications');
}
