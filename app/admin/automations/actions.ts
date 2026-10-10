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
