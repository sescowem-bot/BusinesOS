'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export type AutomationState={ok:boolean;message:string};
export async function requestAutomation(_:AutomationState,fd:FormData):Promise<AutomationState>{
 const {client,businessId,role}=await getWorkspace();
 if(role!=='owner')return {ok:false,message:'Only the business owner can request a custom automation.'};
 const category=String(fd.get('category')||'');const title=String(fd.get('title')||'').trim();
 const details=String(fd.get('details')||'').trim();const channel=String(fd.get('channel')||'in_app');
 if(!['task_reminders','payment_reminders','inventory_alerts','scheduled_reports','custom'].includes(category)||!['in_app','email'].includes(channel)||title.length<5||title.length>160||details.length<20||details.length>3000)return {ok:false,message:'Provide a valid request with at least 20 characters of detail.'};
 const {error}=await client.rpc('request_business_automation',{p_business:businessId,p_category:category,p_title:title,p_details:details,p_channel:channel});
 if(error)return {ok:false,message:'Unable to save request: '+error.message};
 revalidatePath('/automations/requests');revalidatePath('/admin/automations');
 return {ok:true,message:'Request submitted. An administrator will review the scope and provide a quotation before configuration.'};
}
export async function respondToQuote(fd:FormData){
 const {client,role}=await getWorkspace();
 if(role!=='owner')throw new Error('Business owner access required.');
 const id=String(fd.get('request_id')||'');const accept=fd.get('decision')==='accept';
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid request');
 const {error}=await client.rpc('respond_automation_quote',{p_id:id,p_accept:accept});
 if(error)throw new Error('Quote response not saved: '+error.message);
 revalidatePath('/automations/requests');revalidatePath('/admin/automations');
}
