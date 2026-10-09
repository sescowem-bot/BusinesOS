'use server';
import {revalidatePath} from 'next/cache';
import {getServerSupabase} from '@/lib/server/supabase';
export async function requestUpgrade(form:FormData){
 const client=await getServerSupabase();if(!client)return;
 const {data:{user}}=await client.auth.getUser();if(!user)return;
 const businessId=String(form.get('business_id')||'');const planId=String(form.get('plan_id')||'');
 if(!businessId||!planId)return;
 const {error}=await client.rpc('request_business_upgrade',{p_business_id:businessId,p_plan_id:planId,p_justification:String(form.get('reason')||'')});
 if(error)throw new Error('Upgrade request could not be submitted: '+error.message);
 revalidatePath('/upgrade');revalidatePath('/admin/upgrades');
}
