'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export async function reviewUpgrade(form:FormData){
 const session=await requirePlatformAdmin();if(!session)throw new Error('Not authorised');
 const id=String(form.get('request_id')||'');const decision=String(form.get('decision')||'');
 if(!id||!['approve','reject'].includes(decision))throw new Error('Invalid review');
 const {error}=await session.client.rpc('review_business_upgrade',{p_request_id:id,p_approve:decision==='approve',p_note:String(form.get('note')||'')});
 if(error)throw new Error('Unable to complete review: '+error.message);
 revalidatePath('/admin/upgrades');revalidatePath('/upgrade');
}
