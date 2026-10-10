'use server';
import {revalidatePath,updateTag} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {paidCapabilities,planRoles,isPaidFeature,isPlanRole} from '@/lib/plan-catalog';
export type PermissionState={ok:boolean;message:string};
export async function savePlanPermissions(_previous:PermissionState,form:FormData):Promise<PermissionState>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'Platform administrator access required'};
 const planId=String(form.get('plan_id')||'');
 if(!/^[a-z][a-z0-9-]{1,70}$/.test(planId))return {ok:false,message:'Invalid plan identifier'};
 let flags:unknown, roles:unknown;
 try {flags=JSON.parse(String(form.get('features')||'')); roles=JSON.parse(String(form.get('roles')||''));} catch{return {ok:false,message:'Malformed permission configuration'};}
 if(!flags||Array.isArray(flags)||typeof flags!=='object'||!roles||Array.isArray(roles)||typeof roles!=='object')return {ok:false,message:'Invalid permission configuration'};
 const featureMap=flags as Record<string,unknown>, roleMap=roles as Record<string,unknown>;
 if(Object.keys(featureMap).some(x=>!isPaidFeature(x))||Object.keys(roleMap).some(x=>!isPaidFeature(x)))return {ok:false,message:'Unknown module in configuration'};
 for(const feature of paidCapabilities){
  if(typeof featureMap[feature.key]!=='boolean')return {ok:false,message:'Please configure all module permissions'};
  const selected=roleMap[feature.key];
  if(!Array.isArray(selected)||selected.some(x=>typeof x!=='string'||!isPlanRole(x))||selected.includes('owner')||new Set(selected).size!==selected.length)return {ok:false,message:'Invalid staff role permissions'};
 }
 const {error}=await session.client.rpc('admin_save_plan_permissions',{p_plan_id:planId,p_features:featureMap,p_role_features:roleMap});
 if(error)return {ok:false,message:`Could not save permissions: ${error.message}`};
 updateTag('businessos-public-plans');revalidatePath('/admin/plan-access');revalidatePath('/admin/plans');revalidatePath('/pricing');revalidatePath('/upgrade');
 return {ok:true,message:'Module and role permissions saved. Changes also affect businesses currently assigned to this plan.'};
}
