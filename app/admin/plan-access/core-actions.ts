'use server';
import {revalidatePath,updateTag} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {essentialCapabilities} from '@/lib/plan-catalog';
export type CoreAccessState={ok:boolean;message:string};
export async function saveCoreAccess(_:CoreAccessState,form:FormData):Promise<CoreAccessState>{
 const a=await requirePlatformAdmin();if(!a)return {ok:false,message:'System Owner access required.'};
 const plan=String(form.get('plan')||'');
 const feature=String(form.get('feature')||'');
 const enabled=form.get('enabled')==='true';
 if(!/^[a-z][a-z0-9_-]{1,69}$/.test(plan)||!essentialCapabilities.some(x=>x.key===feature))return {ok:false,message:'Invalid plan or module.'};
 const {error}=await a.client.rpc('admin_set_plan_core_feature',{p_plan:plan,p_feature:feature,p_enabled:enabled});
 if(error)return {ok:false,message:'This module setting could not be saved. Your previous permissions remain unchanged.'};
 revalidatePath('/admin/plan-access');revalidatePath('/admin/plan-access/audit');revalidatePath('/admin/plans');
 updateTag('businessos-public-plans');
 return {ok:true,message:(enabled?'Enabled ':'Disabled ')+feature+' for '+plan+'. Existing workspaces on this plan follow this setting.'};
}
