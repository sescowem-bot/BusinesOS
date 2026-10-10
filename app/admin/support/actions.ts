'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export type AdminSupportState={ok:boolean;message:string};
export async function resolvePlatformSupport(_:AdminSupportState,fd:FormData):Promise<AdminSupportState>{
 try{
  const session=await requirePlatformAdmin();if(!session)return {ok:false,message:'Active platform admin required.'};
  const ticket=String(fd.get('ticket')||''),decision=String(fd.get('decision')||''),note=String(fd.get('note')||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(ticket)||!['resolve','decline','apply_role'].includes(decision)||note.length<5||note.length>2000)return {ok:false,message:'Select a valid request, action and an explanatory response.'};
  const {error}=await session.client.rpc('platform_resolve_support_request',{p_ticket:ticket,p_decision:decision,p_note:note});
  if(error)return {ok:false,message:'Support review failed: '+error.message};
  revalidatePath('/admin/support');revalidatePath('/admin/businesses');revalidatePath('/team');
  return {ok:true,message:'Support action saved and audited. No customer account was impersonated.'};
 }catch{return {ok:false,message:'Unable to process support request. Verify SQL 042 and retry.'};}
}
