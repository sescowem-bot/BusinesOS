'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {isPaidFeature} from '@/lib/plan-catalog';
export type TrialState={ok:boolean;message:string};
export async function setTrialModule(_:TrialState,form:FormData):Promise<TrialState>{
 const a=await requirePlatformAdmin();if(!a)return {ok:false,message:'System Owner access required.'};
 const plan=String(form.get('plan')||''),feature=String(form.get('feature')||''),enabled=form.get('enabled')==='on';
 if(!/^[a-z][a-z0-9_-]{1,69}$/.test(plan)||!isPaidFeature(feature)||feature==='campaigns')return {ok:false,message:'Choose a valid plan and available module.'};
 const {error}=await a.client.rpc('admin_set_trial_module',{p_plan:plan,p_feature:feature,p_enabled:enabled});
 if(error)return {ok:false,message:'Trial module setting could not be saved. Ensure it belongs to the selected plan.'};
 revalidatePath('/admin/usage-limits');return {ok:true,message:enabled?'Module approved for trial offers.':'Module removed from new trial offers.'};
}
export async function issueModuleTrial(_:TrialState,form:FormData):Promise<TrialState>{
 const a=await requirePlatformAdmin();if(!a)return {ok:false,message:'System Owner access required.'};
 const business=String(form.get('business')||'');const selection=String(form.get('offer')||'');const [plan,feature]=selection.split('::');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(business)||!/^[a-z][a-z0-9_-]{1,69}$/.test(plan)||!isPaidFeature(feature)||feature==='campaigns')return {ok:false,message:'Choose a business, plan and eligible module.'};
 const {data,error}=await a.client.rpc('admin_issue_business_trial',{p_business:business,p_plan:plan,p_feature:feature});
 if(error)return {ok:false,message:'Trial could not be issued. Check that the offer is active, the business has no existing active grant, and the module has not been trialled before.'};
 revalidatePath('/admin/usage-limits');revalidatePath('/admin/businesses/'+business);
 return {ok:true,message:'Trial access issued. It expires automatically on '+new Date(String(data)).toLocaleDateString('en-NG')+'. No subscription or payment was created.'};
}
