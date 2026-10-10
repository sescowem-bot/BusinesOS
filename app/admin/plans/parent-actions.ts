'use server';
import {revalidatePath,updateTag} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export type ParentState={ok:boolean;message:string};
export async function updatePlanParent(_:ParentState,form:FormData):Promise<ParentState>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'Platform administrator access required.'};
 const plan=String(form.get('plan_id')||'');
 const parent=String(form.get('parent_plan_id')||'');
 const valid=(value:string)=>/^[a-z][a-z0-9_-]{1,70}$/.test(value);
 if(!valid(plan)||(parent!==''&&!valid(parent))||parent===plan)return {ok:false,message:'Choose a different, valid lower-level plan.'};
 const {error}=await session.client.rpc('admin_set_plan_parent',{p_plan_id:plan,p_parent_plan_id:parent||null});
 if(error)return {ok:false,message:error.message};
 updateTag('businessos-public-plans');revalidatePath('/admin/plans');revalidatePath('/admin/plan-access');revalidatePath('/pricing');revalidatePath('/upgrade');
 return {ok:true,message:'Plan inheritance saved. Higher plans now include eligible modules from their linked lower plans.'};
}
