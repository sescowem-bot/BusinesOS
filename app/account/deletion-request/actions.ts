'use server';
import {revalidatePath} from 'next/cache';
import {getServerSupabase} from '@/lib/server/supabase';

export type ClosureRequestState={ok:boolean;message:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitClosureRequest(_old:ClosureRequestState,form:FormData):Promise<ClosureRequestState>{
 const client=await getServerSupabase();
 if(!client)return {ok:false,message:'Sign in before sending an account request.'};
 const {data:{user},error:userError}=await client.auth.getUser();
 if(userError||!user)return {ok:false,message:'Your session expired. Sign in and try again.'};
 const kind=String(form.get('request_type')||'');
 const business=String(form.get('business_id')||'');
 const reason=String(form.get('reason')||'').trim();
 if(!['personal_account_erasure','business_closure'].includes(kind)||
   reason.length<15||reason.length>1000||
   (kind==='business_closure'&&!UUID.test(business))||
   (kind==='personal_account_erasure'&&business!==''))
  return {ok:false,message:'Choose a valid request and give a reason between 15 and 1,000 characters.'};
 const {error}=await client.rpc('submit_platform_deletion_request',{
   p_request_type:kind,p_business:business||null,p_reason:reason
 });
 if(error){
  if(error.code==='23505')return {ok:false,message:'There is already an open request of this type. See the status below.'};
  console.error('[closure-request]',error.code);
  return {ok:false,message:'Your request could not be saved. No account or data was deleted. Please contact support.'};
 }
 revalidatePath('/account/deletion-request');
 revalidatePath('/admin/deletion-requests');
 return {ok:true,message:'Request received for review. Your account, subscription and business records have not been deleted.'};
}
