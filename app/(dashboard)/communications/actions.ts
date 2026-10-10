 'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessFeature} from '@/lib/server/authorization';
function safe(v:FormDataEntryValue|null,max:number){return typeof v==='string'?v.trim().slice(0,max):'';}
export async function createConversation(form:FormData){
 const access=await requireBusinessFeature('communications');if(!access.allowed)throw new Error(access.reason);const {client,businessId}=access;
 const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in required');
 const subject=safe(form.get('subject'),180);if(!subject)throw new Error('Conversation subject required');
 const customerId=safe(form.get('customer_id'),36);
 if(customerId){const {data:linked,error:linkedError}=await client.from('business_customers').select('customer_id').eq('business_id',businessId).eq('customer_id',customerId).maybeSingle();if(linkedError||!linked)throw new Error('Customer does not belong to this workspace');}
 const {error}=await client.from('communication_conversations').insert({business_id:businessId,customer_id:customerId||null,subject,created_by:user.id});if(error)throw new Error('Could not create conversation');
 revalidatePath('/communications');
}
export async function addMessage(form:FormData){
 const access=await requireBusinessFeature('communications');if(!access.allowed)throw new Error(access.reason);const {client,businessId}=access;const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in required');
 const conversationId=safe(form.get('conversation_id'),36),body=safe(form.get('body'),5000);
 const channel=safe(form.get('channel'),10);if(!['internal','email','sms'].includes(channel)||!body)throw new Error('Invalid message');
 const {data:conversation,error:threadError}=await client.from('communication_conversations').select('id').eq('business_id',businessId).eq('id',conversationId).maybeSingle();if(threadError||!conversation)throw new Error('Conversation unavailable');
 const external=channel!=='internal';const {error}=await client.from('communication_messages').insert({business_id:businessId,conversation_id:conversationId,sender_id:user.id,body,channel,direction:external?'outbound':'internal',status:external?'draft':'saved'});if(error)throw new Error('Unable to save message');
 revalidatePath('/communications');
}
export async function createTemplate(form:FormData){
 const access=await requireBusinessFeature('communications');if(!access.allowed)throw new Error(access.reason);const {client,businessId}=access;const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in required');
 const name=safe(form.get('name'),100),body=safe(form.get('body'),5000),subject=safe(form.get('subject'),180),channel=safe(form.get('channel'),10);
 if(!name||!body||!['internal','sms','email'].includes(channel))throw new Error('Complete template fields');
 const {error}=await client.from('communication_templates').insert({business_id:businessId,name,body,subject,channel,created_by:user.id});if(error)throw new Error('Unable to save template');revalidatePath('/communications/settings');
}
export async function saveChannelSettings(form:FormData){
 const access=await requireBusinessFeature('communications');if(!access.allowed)throw new Error(access.reason);const {client,businessId,role}=access;if(role!=='owner')throw new Error('Only business owners can configure communication channels');
 const channel=safe(form.get('channel'),10),provider=safe(form.get('provider'),80)||'not_configured',sender_identity=safe(form.get('sender_identity'),180);
 if(!['sms','email'].includes(channel))throw new Error('Invalid channel');
 const {error}=await client.from('communication_channel_settings').upsert({business_id:businessId,channel,provider,sender_identity,enabled:false,updated_at:new Date().toISOString()},{onConflict:'business_id,channel'});if(error)throw new Error('Unable to save channel configuration');revalidatePath('/communications/settings');
}
