'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {parseActionMatrix,validRole,validPlanId,safeMatrixForPlan,validChangeReason} from '@/lib/role-action-catalog';
export type MatrixSaveState={ok:boolean;message:string};
export async function savePlanActionMatrix(_:MatrixSaveState,form:FormData):Promise<MatrixSaveState>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'Only an active System Owner can manage these permissions.'};
 const plan=form.get('plan_id'),role=form.get('role'),reason=form.get('reason');
 if(!validPlanId(plan)||!validRole(role))return {ok:false,message:'Choose a valid plan and staff role.'};
 if(!validChangeReason(reason))return {ok:false,message:'Explain the permission change in 12–300 characters for the audit history.'};
 const raw=String(form.get('entries')||'');if(raw.length>30000)return {ok:false,message:'Permission data is too large.'};
 let input:unknown;try{input=JSON.parse(raw)}catch{return {ok:false,message:'Malformed permission data.'}};
 const entries=parseActionMatrix(input,role);
 if(!entries||!safeMatrixForPlan(plan,entries))return {ok:false,message:'Permissions were incomplete or would grant unsupported premium access. Refresh and review the plan.'};
 const {error}=await session.client.rpc('admin_save_plan_action_matrix',{p_plan_id:plan,p_role:role,p_entries:entries,p_reason:reason.trim()});
 if(error){
  if(['42P01','42883','PGRST202'].includes(error.code))return {ok:false,message:'The permission schema has not been installed. No settings were saved.'};
  return {ok:false,message:'The permission changes could not be saved; previous settings remain in effect.'};
 }
 revalidatePath('/admin/plan-actions');revalidatePath('/admin/plan-access/audit');
 return {ok:true,message:'Role action settings saved and audited. Database enforcement remains separate and must pass staging security tests.'};
}
