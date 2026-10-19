'use server';
import {revalidatePath,updateTag} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {friendlyServiceError} from '@/lib/user-feedback';
export type PlanPriceState={ok:boolean;message:string};
function parseAmount(value:FormDataEntryValue|null):number|null|undefined{
 const raw=String(value??'').trim();
 if(!raw)return null;
 if(!/^\d{1,12}(?:\.\d{1,2})?$/.test(raw))return undefined;
 const number=Number(raw);
 return Number.isFinite(number)&&number<=999999999999?number:undefined;
}
export async function savePlanPrices(_:PlanPriceState,form:FormData):Promise<PlanPriceState>{
 const admin=await requirePlatformAdmin();
 if(!admin)return {ok:false,message:'Please sign in as a System Owner to change pricing.'};
 const id=String(form.get('plan_id')||'');
 const monthly=parseAmount(form.get('monthly'));
 const annual=parseAmount(form.get('annual'));
 if(!/^[a-z][a-z0-9-]{1,70}$/.test(id)||monthly===undefined||annual===undefined)return {ok:false,message:'Enter a valid monthly or annual amount in naira, with up to two decimal places.'};
 if(id==='free'&&(monthly!==0||annual!==0))return {ok:false,message:'The Free plan must remain ₦0.'};
 if(id!=='free'&&monthly===null&&annual===null)return {ok:false,message:'Enter a monthly or annual price, or keep this plan unpublished until pricing is ready.'};
 // Only update price columns: do not overwrite benefits, publishing, or feature access.
 const {data,error}=await admin.client.from('public_site_plans').update({price_monthly_ngn:id==='free'?0:monthly,price_yearly_ngn:id==='free'?0:annual,updated_by:admin.user.id,updated_at:new Date().toISOString()}).eq('id',id).select('id').maybeSingle();
 if(error){console.error('[plan-pricing] save failed',{code:error.code,plan:id});
  if(['42703','42P01','PGRST204'].includes(error.code||''))return {ok:false,message:'The monthly and annual price columns are unavailable. Verify that subscription migration 044 was installed before saving prices.'};
  if(error.code==='42501'||error.status===403)return {ok:false,message:'Your administrator session cannot update plan prices. Check your System Owner permissions.'};
  return {ok:false,message:friendlyServiceError('save these plan prices',error)};
 }
 if(!data)return {ok:false,message:'This plan was not found. Refresh the list and try again.'};
 updateTag('businessos-public-plans');for(const path of ['/admin/plans','/pricing','/upgrade'])revalidatePath(path);
 return {ok:true,message:'Subscription prices saved. Review the public pricing page to confirm.'};
}
