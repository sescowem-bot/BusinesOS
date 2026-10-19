'use server';
import {getServerSupabase} from '@/lib/server/supabase';
import {getActiveTerms} from '@/lib/server/legal-documents';
export type TermsAcceptanceState={ok:boolean;message:string};
export async function acceptOnboardingTerms(_:TermsAcceptanceState,form:FormData):Promise<TermsAcceptanceState>{
 const client=await getServerSupabase();
 if(!client)return {ok:false,message:'Please sign in first.'};
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)return {ok:false,message:'Please sign in first.'};
 const terms=await getActiveTerms();
 if(!terms.available||!terms.document)return {ok:false,message:'Approved Terms are temporarily unavailable.'};
 if(form.get('agree_terms')!=='on'||form.get('terms_id')!==terms.document.id)
  return {ok:false,message:'Review and accept the current Terms of Service.'};
 const {error}=await client.rpc('accept_current_terms',{p_document_id:terms.document.id});
 if(error){console.error('[legal] acceptance failed',{code:error.code});return {ok:false,message:'We could not record your agreement. Please try again.'};}
 return {ok:true,message:'Your Terms acknowledgement has been recorded.'};
}
