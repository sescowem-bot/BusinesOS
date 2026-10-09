'use server';import {redirect} from 'next/navigation';import {getServerSupabase} from '@/lib/server/supabase';
export type OnboardState={error:string};
export async function createWorkspace(_s:OnboardState,form:FormData):Promise<OnboardState>{
 const name=String(form.get('business_name')||'').trim();const category=String(form.get('category')||'Other').slice(0,80);
 if(name.length<2||name.length>120)return {error:'Business name must be 2 to 120 characters.'};
 const client=await getServerSupabase();if(!client)return {error:'Authentication is not configured.'};
 const {data:{user}}=await client.auth.getUser();if(!user)return {error:'Sign in before creating a business.'};
 const {error}=await client.rpc('create_my_business_workspace',{p_name:name,p_category:category});
 if(error)return {error:'Unable to create workspace. Confirm that migration 004 is installed, or try a different business name.'};
 redirect('/dashboard');
}
