'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export type PrivacyRequestState={ok:boolean;message:string};
export async function submitPrivacyRequest(_:PrivacyRequestState,form:FormData):Promise<PrivacyRequestState>{
 try{
  const w=await getWorkspace();
  const kind=String(form.get('kind')||'');
  const details=String(form.get('details')||'').trim();
  const scope=String(form.get('scope')||'mine');
  if(!['access','correction','portability','deletion','restriction','objection','consent','other'].includes(kind))
   return {ok:false,message:'Select a valid request type.'};
  if(details.length<10||details.length>2000)
   return {ok:false,message:'Describe your request in 10–2000 characters.'};
  if(!['mine','business'].includes(scope)||(scope==='business'&&w.role!=='owner'))
   return {ok:false,message:'Only an authorised business owner can submit a business-wide request.'};
  const {error}=await w.client.rpc('submit_privacy_rights_request',{
   p_business:scope==='business'?w.businessId:null,p_kind:kind,p_details:details
  });
  if(error){console.error('[privacy] submit',{code:error.code});return {ok:false,message:'We couldn't send your request right now. Please try again or contact support.'};}
  revalidatePath('/settings/privacy');
  return {ok:true,message:'Your request has been received. We'll review it and contact you if we need more information.'};
 }catch{return {ok:false,message:'Unable to submit your request. Please sign in and try again.'};}
}
