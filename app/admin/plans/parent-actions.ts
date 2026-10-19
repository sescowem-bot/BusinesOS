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
 if(error){console.error('[plan-parent] save failed',{code:error.code,plan,message:error.message});if(error.code==='PGRST202'||error.code==='42883')return {ok:false,message:'The plan relationship function is unavailable. Verify subscription migration 029 before trying again.'};if(['42P01','PGRST205'].includes(error.code||''))return {ok:false,message:'Subscription relationships are not set up in the database. Check SQL 029 in System Health.'};if(error.code==='23503')return {ok:false,message:'One of these plans no longer exists. Refresh and select another plan.'};if(/circular|too deep|invalid parent/i.test(error.message))return {ok:false,message:'These plans cannot be linked in that order. Choose a different plan.'};if(error.code==='42501')return {ok:false,message:'Your System Owner session cannot change plan access. Sign in again and confirm your permissions.'};return {ok:false,message:friendlyServiceError('update plan inheritance', error)+` (Reference: ${error.code||'unknown'})`};}
 updateTag('businessos-public-plans');revalidatePath('/admin/plans');revalidatePath('/admin/plan-access');revalidatePath('/pricing');revalidatePath('/upgrade');
 return {ok:true,message:'Plan inheritance saved. Higher plans now include eligible modules from their linked lower plans.'};
}
