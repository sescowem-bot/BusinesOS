'use server';
import {redirect} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';
export type OnboardState={error:string};
function workspaceError(code?:string,message?:string){
 const hint=(message||'').toLowerCase();
 if(code==='23505')return 'This workspace could not be created because a conflicting record exists. Please try again.';
 if(code==='42501'||hint.includes('permission denied'))return 'Your account does not have permission to create a business workspace. Contact support.';
 if(code==='PGRST202'||code==='42883'||hint.includes('function')&&hint.includes('not found'))return 'Your workspace could not be created right now. Please try again, or contact support.';
 if(hint.includes('profile not found')||code==='23503')return 'Your account profile is not ready. Sign out, sign back in, and try again. If it continues, contact support.';
 return 'Unable to create workspace. Please try again or contact support. No business record was confirmed.';
}
export async function createWorkspace(_s:OnboardState,form:FormData):Promise<OnboardState>{
 const name=String(form.get('business_name')||'').trim();
 const category=String(form.get('category')||'Other').trim().slice(0,80);
 if(name.length<2||name.length>120)return {error:'Business name must be 2 to 120 characters.'};
 const client=await getServerSupabase();if(!client)return {error:'Registration is temporarily unavailable. Please try again later.'};
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)return {error:'Please sign in again before creating a business.'};
 const {data:existing,error:lookupError}=await client.from('business_members').select('business_id').eq('user_id',user.id).limit(1);
 if(lookupError)return {error:'Unable to verify existing workspaces. Please contact support.'};
 if(existing?.length)redirect('/dashboard');
 const {data:businessId,error}=await client.rpc('create_my_business_workspace',{p_name:name,p_category:category});
 if(error)return {error:workspaceError(error.code,error.message)};
 if(!businessId)return {error:'We couldn’t confirm your new workspace. Check your workspaces before trying again, or contact support.'};
 redirect('/dashboard');
}
