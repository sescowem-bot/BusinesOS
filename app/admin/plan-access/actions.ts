'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export async function setPlanFeature(form:FormData){
 const session=await requirePlatformAdmin();if(!session)throw new Error('Administrator access required');
 const planId=String(form.get('plan_id')||'');const feature=String(form.get('feature_key')||'');
 if(!planId||!feature)throw new Error('Invalid plan or feature');
 const {error}=await session.client.rpc('admin_set_plan_feature',{p_plan_id:planId,p_feature_key:feature,p_enabled:form.get('enabled')==='true'});
 if(error)throw new Error('Could not save feature: '+error.message);
 revalidatePath('/admin/plan-access');
}
