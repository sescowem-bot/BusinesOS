'use server';
import {friendlyServiceError} from '@/lib/user-feedback';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {isPaidFeature,planRoles} from '@/lib/plan-catalog';
export type AccessFormState={ok:boolean;message:string};
const failed=(message:string):AccessFormState=>({ok:false,message});
const good=(message:string):AccessFormState=>({ok:true,message});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cost=(v:string)=>!v.trim()?null:/^\d{1,12}(?:\.\d{1,2})?$/.test(v)?Number(v):NaN;
const validRole=(s:string)=>planRoles.some(x=>x.key===s)&&s!=='owner';
function refresh(id:string){revalidatePath(`/admin/businesses/${id}`);revalidatePath('/admin/plans');revalidatePath('/admin/plan-access');}
export async function saveCompanyModulePrice(_:AccessFormState,form:FormData):Promise<AccessFormState>{
 const a=await requirePlatformAdmin();if(!a)return failed('Platform administrator access is required.');
 const business=String(form.get('business')||''),feature=String(form.get('feature')||'');
 const monthly=cost(String(form.get('monthly')||'')),yearly=cost(String(form.get('yearly')||''));
 const note=String(form.get('note')||'').trim();
 if(!UUID.test(business)||!isPaidFeature(feature)||monthly===null&&yearly===null||[monthly,yearly].some(x=>x!==null&&!Number.isFinite(x))||note.length>500)
  return failed('Choose a module and enter a valid monthly or annual NGN amount.');
 const {error}=await a.client.rpc('admin_set_business_feature_price',{p_business:business,p_feature:feature,p_monthly:monthly,p_yearly:yearly,p_note:note});
 if(error)return failed(friendlyServiceError('save this price', error));
 refresh(business);return good('Commercial terms saved for this business only. No money was charged.');
}
export async function saveCompanyRole(_:AccessFormState,form:FormData):Promise<AccessFormState>{
 const a=await requirePlatformAdmin();if(!a)return failed('Platform administrator access is required.');
 const business=String(form.get('business')||''),profile=String(form.get('profile')||''),name=String(form.get('name')||'').trim(),description=String(form.get('description')||'').trim(),base=String(form.get('base_role')||'');
 const modules=Array.from(new Set(form.getAll('module').map(String)));
 const active=form.get('active')==='yes';
 if(!UUID.test(business)||profile!==''&&!UUID.test(profile)||name.length<3||name.length>70||description.length>500||!validRole(base)||modules.length>11||modules.some(x=>!isPaidFeature(x)))return failed('Check the role name, base role and module permissions.');
 const {error}=await a.client.rpc('admin_save_company_role',{p_business:business,p_profile:profile||null,p_name:name,p_description:description,p_base:base,p_modules:modules,p_active:active});
 if(error)return failed(friendlyServiceError('save this company role', error));
 refresh(business);return good('Company role profile saved and recorded in the audit history.');
}
export async function assignCompanyRole(_:AccessFormState,form:FormData):Promise<AccessFormState>{
 const a=await requirePlatformAdmin();if(!a)return failed('Platform administrator access is required.');
 const business=String(form.get('business')||''),user=String(form.get('user')||''),profile=String(form.get('profile')||'');
 if(![business,user].every(x=>UUID.test(x))||profile!==''&&!UUID.test(profile))return failed('Choose a valid staff member and role profile.');
 const rpc=profile?'admin_assign_company_role':'admin_clear_company_role';
 const {error}=await a.client.rpc(rpc,profile?{p_business:business,p_user:user,p_profile:profile}:{p_business:business,p_user:user});
 if(error)return failed(friendlyServiceError('assign this role', error));
 refresh(business);return good('Company-specific staff role updated. Existing ownership and base-role permissions were preserved.');
}
