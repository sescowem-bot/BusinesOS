'use server';import {redirect} from 'next/navigation';import {getServerSupabase} from '@/lib/server/supabase';
export type OnboardState={error:string};
export async function createWorkspace(_s:OnboardState,form:FormData):Promise<OnboardState>{
 const name=String(form.get('business_name')||'').trim();const category=String(form.get('category')||'Other').slice(0,80);
 if(name.length<2||name.length>120)return {error:'Business name must be 2 to 120 characters.'};
 const client=await getServerSupabase();if(!client)return {error:'Authentication is not configured.'};
 const {data:{user}}=await client.auth.getUser();if(!user)return {error:'Sign in before creating a business.'};
 const {error}=await client.rpc('create_my_business_workspace',{p_name:name,p_category:category});
 if(error){
  console.error('Workspace RPC failed', {code:error.code, message:error.message, details:error.details, hint:error.hint});
  const label = error.code === 'PGRST202' ? 'The workspace function was not found. Check migration 004 and the Supabase project connection.'
    : error.code === '42501' ? 'The database denied permission to create a workspace.'
    : error.message?.includes('Profile not found') ? 'Your authentication profile is missing. The signup profile trigger may need repair.'
    : error.message?.includes('Authentication required') ? 'Your session has expired. Please sign in again.'
    : error.code === '23505' ? 'A unique database value already exists. Please retry.'
    : 'Workspace creation failed. Please contact support with the database error code.';
  return {error: `${label} (code: ${error.code || 'unknown'})`};
 }
 redirect('/dashboard');
}
