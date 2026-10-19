'use server';
import {friendlyServiceError} from '@/lib/user-feedback';
import {revalidatePath,updateTag} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export type ParentState={ok:boolean;message:string};
export async function updatePlanParent(_:ParentState,form:FormData):Promise<ParentState>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'Platform administrator access required.'};
 const plan=String(form.get('plan_id')||'');
 const parent=String(form.get('parent_plan_id')||'');
 const original=String(form.get('original_parent_id')||'');
 const valid=(value:string)=>/^[a-z][a-z0-9_-]{1,70}$/.test(value);
 if(!valid(plan)||(parent!==''&&!valid(parent))||parent===plan)return {ok:false,message:'Choose a different, valid lower-level plan.'};
 if(parent===original)return {ok:true,message:'No change needed. This plan relationship is already saved.'};
 const {error}=await session.client.rpc('admin_set_plan_parent',{p_plan_id:plan,p_parent_plan_id:parent||null});
 if(error){console.error('[plan-parent] save failed',{code:error.code,plan});if(error.code==='PGRST202'||error.code==='42883')return {ok:false,message:'The plan relationship function is unavailable. Verify subscription migration 029 before trying again.'};if(error.code==='42501')return {ok:false,message:'Your System Owner session cannot change plan access. Sign in again and confirm your permissions.'};return {ok:false,message:friendlyServiceError('update plan inheritance', error)};}
 updateTag('businessos-public-plans');revalidatePath('/admin/plans');revalidatePath('/admin/plan-access');revalidatePath('/pricing');revalidatePath('/upgrade');
 return {ok:true,message:'Plan inheritance saved. Higher plans now include eligible modules from their linked lower plans.'};
}
