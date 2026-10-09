'use server';
import {redirect} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';
export type SignupState={error:string;success:string};
export async function signUp(_state:SignupState,data:FormData):Promise<SignupState>{
 const name=String(data.get('name')||'').trim();
 const email=String(data.get('email')||'').trim().toLowerCase();
 const password=String(data.get('password')||'');
 if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<12)return {error:'Provide your full name, valid email and a password of at least 12 characters.',success:''};
 const client=await getServerSupabase();if(!client)return {error:'Supabase configuration is missing. Your deployment needs NEXT_PUBLIC_SUPABASE_URL and a publishable or anon key. Check Vercel environment variables, then redeploy.',success:''};
 const {data:result,error}=await client.auth.signUp({email,password,options:{data:{full_name:name}}});
 if(error){const safeCode=error.code?` (${error.code})`:'';return {error:`Signup failed${safeCode}: ${error.message}`,success:''};}
 if(!result.session)return {error:'',success:'Account request received. Check your email for a verification link, then sign in.'};
 redirect('/onboarding');
}
