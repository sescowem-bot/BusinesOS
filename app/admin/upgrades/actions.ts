'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export type ReviewResult={ok:boolean;message:string};
export async function reviewUpgrade(_previous:ReviewResult,form:FormData):Promise<ReviewResult>{
 const session=await requirePlatformAdmin();if(!session)return {ok:false,message:'Platform administrator access required.'};
 const id=String(form.get('request_id')||'');
 const decision=String(form.get('decision')||'');
 const note=String(form.get('note')||'').trim();
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)||!['approve','reject'].includes(decision)||note.length>1200)return {ok:false,message:'Review details are invalid.'};
 const {error}=await session.client.rpc('review_business_upgrade',{p_request_id:id,p_approve:decision==='approve',p_note:note});
 if(error){
  const msg=error.message.toLowerCase();
  if(msg.includes('already reviewed'))return {ok:false,message:'This request has already been reviewed. Refresh the page.'};
  if(msg.includes('no longer available'))return {ok:false,message:'The requested plan is no longer published.'};
  return {ok:false,message:'The review could not be saved. Check database permissions or contact support.'};
 }
 revalidatePath('/admin/upgrades');revalidatePath('/admin/businesses');revalidatePath('/upgrade');
 return {ok:true,message:`Request ${decision==='approve'?'approved':'rejected'} successfully.`};
}
