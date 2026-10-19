'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export type ReviewPrivacyState={ok:boolean;message:string};
export async function reviewPrivacyRequest(_:ReviewPrivacyState,form:FormData):Promise<ReviewPrivacyState>{
 try{
  const admin=await requirePlatformAdmin();
  if(!admin)return {ok:false,message:'Authorised platform administrator required.'};
  const id=String(form.get('id')||'');
  const status=String(form.get('status')||'');
  const response=String(form.get('response')||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(id)||!['reviewing','verification_required','completed','declined'].includes(status)||response.length<5||response.length>2000)
   return {ok:false,message:'Select a valid request, review status and response (5–2000 characters).'};
  const {error}=await admin.client.rpc('review_privacy_rights_request',{p_request:id,p_status:status,p_response:response});
  if(error){console.error('[privacy-review]',{code:error.code});return {ok:false,message:'The review could not be saved. Check migration 051 and your administrator access.'};}
  revalidatePath('/admin/privacy');
  revalidatePath('/settings/privacy');
  return {ok:true,message:'Privacy request status updated. Complete any required action outside this status form and retain supporting evidence.'};
 }catch{return {ok:false,message:'The privacy review could not be completed.'};}
}
