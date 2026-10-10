'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {ACTIVE_BUSINESS_COOKIE,businessCookieOptions} from '@/lib/server/workspace-selection';

export type OwnWorkspaceState={error:string};

/** A System Owner may open only a workspace where they have an actual business_members record. */
export async function openMyBusiness(form:FormData){
 const session=await requirePlatformAdmin();
 if(!session)redirect('/login');
 const id=String(form.get('business_id')||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/admin/my-business?error=selection');
 const {data:member,error}=await session.client.from('business_members')
  .select('business_id').eq('business_id',id).eq('user_id',session.user.id).maybeSingle();
 if(error||!member)redirect('/admin/my-business?error=selection');
 (await cookies()).set(ACTIVE_BUSINESS_COOKIE,member.business_id,businessCookieOptions);
 redirect('/dashboard');
}

/** Reuses migration 004's authenticated workspace bootstrap; does not grant access to any other tenant. */
export async function createMyBusiness(_previous:OwnWorkspaceState,form:FormData):Promise<OwnWorkspaceState>{
 const session=await requirePlatformAdmin();
 if(!session)return {error:'Your System Owner session has expired. Sign in again.'};
 const name=String(form.get('business_name')||'').trim();
 const category=String(form.get('category')||'Other').trim().slice(0,80)||'Other';
 if(name.length<2||name.length>120)return {error:'Enter a business name between 2 and 120 characters.'};
 const {data:businessId,error}=await session.client.rpc('create_my_business_workspace',{
  p_name:name,p_category:category
 });
 if(error){
  if(error.message?.toLowerCase().includes('profile not found'))return {error:'Your account profile is not ready. Sign out, then sign back in and try again.'};
  return {error:'Your workspace could not be created. Please check the Supabase workspace setup and try again.'};
 }
 if(typeof businessId!=='string'||!/^[0-9a-f-]{36}$/i.test(businessId))return {error:'The database did not confirm a new workspace.'};
 // Creation RPC records the signed-in person as owner; verify it before selecting the workspace.
 const {data:membership,error:memberError}=await session.client.from('business_members')
  .select('business_id').eq('user_id',session.user.id).eq('business_id',businessId).eq('role','owner').maybeSingle();
 if(memberError||!membership)return {error:'Your workspace was created but access could not be confirmed. Reopen My Business before trying again.'};
 (await cookies()).set(ACTIVE_BUSINESS_COOKIE,businessId,businessCookieOptions);
 redirect('/dashboard');
}
