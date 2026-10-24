'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export type LimitState={ok:boolean;message:string};
const allowed=new Set(['customers','products','team_members','branches','orders_monthly']);
const validPlan=(s:string)=>/^[a-z][a-z0-9_-]{1,69}$/.test(s);
export async function saveLimit(_:LimitState,form:FormData):Promise<LimitState>{
 const admin=await requirePlatformAdmin();if(!admin)return {ok:false,message:'System Owner access required.'};
 const plan=String(form.get('plan')||''),metric=String(form.get('metric')||''),count=String(form.get('count')||''),reason=String(form.get('reason')||'').trim();
 if(!validPlan(plan)||!allowed.has(metric)||!/^(0|[1-9]\d{0,8})$/.test(count)||reason.length<12||reason.length>300)
  return {ok:false,message:'Enter a valid whole-number limit and an explanation of 12–300 characters.'};
 const {error}=await admin.client.rpc('admin_set_plan_quota',{p_plan:plan,p_metric:metric,p_max:Number(count),p_reason:reason});
 if(error)return {ok:false,message:'The change could not be saved. Previous limits remain unchanged.'};
 revalidatePath('/admin/usage-limits');return {ok:true,message:'Limit saved and audited. Numerical enforcement remains independently controlled.'};
}
export async function saveTrial(_:LimitState,form:FormData):Promise<LimitState>{
 const admin=await requirePlatformAdmin();if(!admin)return {ok:false,message:'System Owner access required.'};
 const plan=String(form.get('plan')||''),days=String(form.get('days')||''),enabled=form.get('enabled')==='on';
 if(!validPlan(plan)||!/^(0|[1-9]|[12][0-9]|30)$/.test(days))
  return {ok:false,message:'Enter a trial length from 0 to 30 days.'};
 const {error}=await admin.client.rpc('admin_set_plan_trial',{p_plan:plan,p_days:Number(days),p_enabled:enabled});
 if(error)return {ok:false,message:'Trial preference could not be saved.'};
 revalidatePath('/admin/usage-limits');return {ok:true,message:'Trial preference saved. Customer trial activation remains separate and inactive.'};
}
