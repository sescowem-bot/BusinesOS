'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export type ManualPlanState={ok:boolean;message:string};
export async function setManualBusinessPlan(_state:ManualPlanState,form:FormData):Promise<ManualPlanState>{
 const admin=await requirePlatformAdmin();
 if(!admin)return {ok:false,message:'You need System Owner access to change subscriptions.'};
 const business=String(form.get('business')||''),plan=String(form.get('plan')||''),reason=String(form.get('reason')||'').trim();
 const expiry=String(form.get('expires')||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(business)||!/^[a-z0-9][a-z0-9_-]{0,69}$/.test(plan)||reason.length<12||reason.length>500)
  return {ok:false,message:'Select a plan and explain why you are making this change (at least 12 characters).'};
 const expires=expiry?new Date(`${expiry}T23:59:59+01:00`):null;
 if(expires&&(Number.isNaN(expires.getTime())||expires.getTime()<=Date.now()))return {ok:false,message:'Choose a future end date or leave it blank.'};
 const {error}=await admin.client.rpc('admin_assign_business_subscription',{
  p_business:business,p_plan:plan,p_reason:reason,p_expires_at:expires?.toISOString()||null
 });
 if(error){console.error('[businessos-admin] manual subscription update failed',error.code);
  return {ok:false,message:'Subscription could not be updated. Please check the plan and your permissions.'};}
 revalidatePath(`/admin/businesses/${business}`);revalidatePath('/admin/businesses');revalidatePath('/upgrade');
 return {ok:true,message:'Subscription updated. This administrative change did not charge the customer.'};
}
