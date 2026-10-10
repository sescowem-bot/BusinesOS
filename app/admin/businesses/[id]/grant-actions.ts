'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {isPaidFeature,isPlanRole} from '@/lib/plan-catalog';
export type GrantState={ok:boolean;message:string};
export async function saveBusinessGrant(_:GrantState,fd:FormData):Promise<GrantState>{
 const session=await requirePlatformAdmin();if(!session)return {ok:false,message:'Platform administrator access required.'};
 const businessId=String(fd.get('business_id')||'');const feature=String(fd.get('feature')||'');
 const enabled=String(fd.get('enabled'))==='yes';
 const roles=Array.from(new Set(fd.getAll('roles').map(String)));
 const expires=String(fd.get('expires_at')||'');const note=String(fd.get('note')||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(businessId)||!isPaidFeature(feature)||roles.some(r=>!isPlanRole(r))||!roles.includes('owner')||roles.length>6||note.length<5||note.length>1000)return {ok:false,message:'Check business, module, roles and change reason.'};
 if(expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires))return {ok:false,message:'Invalid expiry date.'};
 const expiry=expires?`${expires}T23:59:59.000Z`:null;
 const {error}=await session.client.rpc('admin_set_business_feature_grant',{
  p_business:businessId,p_feature:feature,p_enabled:enabled,p_roles:roles,p_expires_at:expiry,p_note:note
 });
 if(error)return {ok:false,message:error.message};
 revalidatePath(`/admin/businesses/${businessId}`);revalidatePath('/admin/businesses');
 return {ok:true,message:'Business-specific access saved with an audit record.'};
}
