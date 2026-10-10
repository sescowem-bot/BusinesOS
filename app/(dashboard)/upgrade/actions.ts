'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export type UpgradeResult={ok:boolean;message:string};
export async function requestUpgrade(_previous:UpgradeResult,form:FormData):Promise<UpgradeResult>{
 const {client,businessId,role}=await getWorkspace();
 if(role!=='owner')return {ok:false,message:'Only the business owner can request a plan change.'};
 const planId=String(form.get('plan_id')||'').trim();
 const reason=String(form.get('reason')||'').trim();
 if(!/^[a-z0-9][a-z0-9_-]{0,69}$/.test(planId))return {ok:false,message:'Please select a valid plan.'};
 if(reason.length>1200)return {ok:false,message:'Your reason must be 1,200 characters or fewer.'};
 const {data:plan,error:planError}=await client.from('public_site_plans').select('id').eq('id',planId).eq('published',true).maybeSingle();
 if(planError||!plan)return {ok:false,message:'This pricing plan is unavailable. Refresh the page and try again.'};
 const {error}=await client.rpc('request_business_upgrade',{p_business_id:businessId,p_plan_id:planId,p_justification:reason});
 if(error){
  const normalized=error.message.toLowerCase();
  if(normalized.includes('already awaiting'))return {ok:false,message:'A request is already awaiting administrator review.'};
  if(normalized.includes('already on this plan'))return {ok:false,message:'Your business is already on this plan.'};
  if(normalized.includes('only the business owner'))return {ok:false,message:'Only the business owner can request an upgrade.'};
  return {ok:false,message:'The upgrade request could not be saved. Please try again or contact platform support.'};
 }
 revalidatePath('/upgrade');revalidatePath('/admin/upgrades');
 return {ok:true,message:'Your request has been submitted for platform administrator review. Your current plan remains unchanged.'};
}
