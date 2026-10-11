'use server';
import {revalidatePath,updateTag} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export type TierMatrixState={ok:boolean;message:string};
export async function applyStandardPlanMatrix(_prev:TierMatrixState,form:FormData):Promise<TierMatrixState>{
 const admin=await requirePlatformAdmin();
 if(!admin)return {ok:false,message:'Only the System Owner can change standard subscription features.'};
 const confirmation=String(form.get('confirmation')||'');
 if(confirmation!=='APPLY STANDARD PLANS')return {ok:false,message:'Please type APPLY STANDARD PLANS exactly to confirm.'};
 const {data,error}=await admin.client.rpc('admin_apply_standard_plan_matrix',{p_confirmation:confirmation});
 if(error){console.error('[tier-matrix] update failed',error.code);return {ok:false,message:'We could not update the plan features. Check that SQL 049 is installed and try again.'};}
 updateTag('businessos-public-plans');
 for(const path of ['/pricing','/upgrade','/admin/plans','/admin/plan-access','/admin/businesses'])revalidatePath(path);
 return {ok:true,message:`Standard plan differences saved. ${Number(data)||0} currently assigned businesses may be affected. Prices were not changed.`};
}
