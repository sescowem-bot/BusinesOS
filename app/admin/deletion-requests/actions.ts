'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';

export type ReviewState={ok:boolean;message:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function reviewClosureRequest(_old:ReviewState,form:FormData):Promise<ReviewState>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'Only the System Owner can review account closure.'};
 const id=String(form.get('request_id')||'');
 const status=String(form.get('status')||'');
 const note=String(form.get('review_note')||'').trim();
 const approved=status==='approved_for_processing';
 const identity=form.get('identity')==='yes';
 const retention=form.get('retention')==='yes';
 const payments=form.get('payments')==='yes';
 const exports=form.get('exports')==='yes';
 if(!UUID.test(id)||!['verification_required','under_review','approved_for_processing','declined'].includes(status)||
   note.length<15||note.length>1200||
   (approved&&(!identity||!retention||!payments||!exports||note.length<20)))
  return {ok:false,message:'Check the decision, note and verification evidence. Processing approval requires all four checks.'};
 const {error}=await session.client.rpc('platform_review_deletion_request',{
   p_request:id,p_status:status,p_note:note,
   p_identity_verified:identity,p_retention_reviewed:retention,
   p_payment_reviewed:payments,p_export_considered:exports
 });
 if(error){
  console.error('[closure-review]',error.code);
  return {ok:false,message:'Review could not be saved. No records were deleted.'};
 }
 revalidatePath('/admin/deletion-requests');
 revalidatePath('/account/deletion-request');
 return {ok:true,message:'Review saved. This did not cancel a subscription or delete any records.'};
}
