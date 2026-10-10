'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export type SupportState={ok:boolean;message:string};
export async function submitSupportRequest(_:SupportState,fd:FormData):Promise<SupportState>{
 try{
  const {client,businessId,role}=await getWorkspace();
  const kind=String(fd.get('kind')||'general');
  const subject=String(fd.get('subject')||'').trim(),details=String(fd.get('details')||'').trim();
  const target=String(fd.get('target')||''),proposed=String(fd.get('proposed_role')||'');
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!['general','role_change'].includes(kind)||subject.length<5||subject.length>140||details.length<10||details.length>2000)return {ok:false,message:'Provide a clear subject (5–140 characters) and explanation (10–2000 characters).'};
  if(kind==='role_change'&&(role!=='owner'||!UUID.test(target)||!['manager','sales','inventory','finance','staff'].includes(proposed)))return {ok:false,message:'Only an owner can request a specific non-owner team role change.'};
  const {error}=await client.rpc('business_open_support_request',{p_business:businessId,p_kind:kind,p_subject:subject,p_details:details,p_target:kind==='role_change'?target:null,p_role:kind==='role_change'?proposed:null});
  if(error)return {ok:false,message:'Support request could not be saved: '+error.message};
  revalidatePath('/support');revalidatePath('/admin/support');
  return {ok:true,message:'Support request saved. The platform team can review it in the admin console.'};
 }catch{return {ok:false,message:'Support is temporarily unavailable. Refresh and try again.'};}
}
