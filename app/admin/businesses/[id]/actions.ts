'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requirePlatformAdmin} from '@/lib/server/supabase';

export type ReviewState={ok:boolean;message:string};
const inputSchema=z.object({
 business_id:z.string().uuid(),
 status:z.enum(['open','review','resolved']),
 note:z.string().trim().max(3000)
});
export async function saveBusinessReview(_state:ReviewState,form:FormData):Promise<ReviewState>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'Administrator access required.'};
 const parsed=inputSchema.safeParse({business_id:form.get('business_id'),status:form.get('status'),note:form.get('note')});
 if(!parsed.success)return {ok:false,message:'Please check the business, status and note length.'};
 const {error}=await session.client.rpc('platform_save_business_review',{
  p_business_id:parsed.data.business_id,p_status:parsed.data.status,p_note:parsed.data.note
 });
 if(error)return {ok:false,message:'Review could not be saved: '+error.message};
 revalidatePath('/admin/businesses');
 revalidatePath(`/admin/businesses/${parsed.data.business_id}`);
 return {ok:true,message:'Internal business review saved.'};
}
