'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export type AdminAutomationState={ok:boolean;message:string};
export async function reviewAutomation(_:AdminAutomationState,fd:FormData):Promise<AdminAutomationState>{
 const session=await requirePlatformAdmin();if(!session)return {ok:false,message:'Administrator access required.'};
 const id=String(fd.get('request_id')||'');const action=String(fd.get('decision')||'');
 const quote=String(fd.get('quote_note')||'').trim();const note=String(fd.get('admin_note')||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['quote','decline','configured'].includes(action)||quote.length>1500||note.length>1500)return {ok:false,message:'Invalid review details.'};
 if(action==='quote'&&quote.length<5)return {ok:false,message:'Enter the pricing and delivery terms.'};
 const {error}=await session.client.rpc('admin_review_automation_request',{p_id:id,p_action:action,p_quote_note:quote,p_admin_note:note});
 if(error)return {ok:false,message:error.message};
 revalidatePath('/admin/automations');revalidatePath('/automations/requests');
 return {ok:true,message:'Request status updated and in-app notifications recorded.'};
}

export async function configureAutomationRule(_:AdminAutomationState,fd:FormData):Promise<AdminAutomationState>{
 const session=await requirePlatformAdmin();if(!session)return {ok:false,message:'Administrator access required.'};
 const requestId=String(fd.get('request_id')||'');
 const message=String(fd.get('message')||'').trim();
 const hours=Number(fd.get('cadence_hours'));
 const maxRuns=Number(fd.get('max_runs'));
 const raw=String(fd.get('next_run_utc')||'');
 if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(requestId)
    ||message.length<8||message.length>500||![24,168].includes(hours)
    ||!Number.isInteger(maxRuns)||maxRuns<1||maxRuns>365
    ||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(raw))return {ok:false,message:'Enter valid reminder details and a UTC start date.'};
 const next=new Date(`${raw}:00Z`);
 if(!Number.isFinite(next.getTime())||next.getTime()<=Date.now()||next.getTime()>Date.now()+365*86400000)
  return {ok:false,message:'Start time must be in the future, within the next 365 days.'};
 const {error}=await session.client.rpc('admin_configure_automation_rule',{
  p_request_id:requestId,p_message:message,p_cadence_hours:hours,p_next_run_at:next.toISOString(),p_max_runs:maxRuns
 });
 if(error)return {ok:false,message:error.message};
 revalidatePath('/admin/automations');revalidatePath('/automations/requests');
 return {ok:true,message:'Reminder configured in paused mode. Activate it separately after verifying recipient consent and schedule.'};
}

export async function toggleAutomationRule(_:AdminAutomationState,fd:FormData):Promise<AdminAutomationState>{
 const session=await requirePlatformAdmin();if(!session)return {ok:false,message:'Administrator access required.'};
 const id=String(fd.get('rule_id')||'');const enabled=String(fd.get('enabled')||'')==='true';
 if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id))return {ok:false,message:'Invalid automation rule.'};
 const {error}=await session.client.rpc('admin_set_automation_rule_enabled',{p_rule_id:id,p_enabled:enabled});
 if(error)return {ok:false,message:error.message};
 revalidatePath('/admin/automations');revalidatePath('/automations/requests');
 return {ok:true,message:enabled?'Reminder activated. It will run only when the protected scheduler is configured.':'Reminder paused.'};
}
