'use server';
import {redirect} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';
import {explainAuthError} from '@/lib/auth-feedback';
export type SignupState={error:string;success:string;retryAfterSeconds:number;reason:string};
const failed=(error:string):SignupState=>({error,success:'',retryAfterSeconds:0,reason:'general'});
export async function signUp(_state:SignupState,data:FormData):Promise<SignupState>{
 const name=String(data.get('name')||'').trim();
 const email=String(data.get('email')||'').trim().toLowerCase();
 const password=String(data.get('password')||'');
 const confirm=String(data.get('confirm_password')||'');
 if(name.length<2||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128)
  return failed('Enter your full name, a valid email and a password of 12–128 characters.');
 if(password!==confirm)return failed('The two passwords do not match. Please check and try again.');
 const client=await getServerSupabase();
 if(!client)return failed('Registration is temporarily unavailable. Please contact BusinessOS support.');
 const site=process.env.NEXT_PUBLIC_SITE_URL||process.env.NEXT_PUBLIC_APP_URL;
 const redirectUrl=site&&/^https:\/\/[^/]+/.test(site)?`${site.replace(/\/$/,'')}/auth/callback?next=/onboarding`:undefined;
 let result;
 try{result=await client.auth.signUp({email,password,options:{data:{full_name:name},...(redirectUrl?{emailRedirectTo:redirectUrl}:{})}})}
 catch{return failed('Registration is temporarily unavailable. Please try again later.');}
 if(result.error){const feedback=explainAuthError(result.error,'signup');return {error:feedback.message,success:'',retryAfterSeconds:feedback.retryAfterSeconds,reason:feedback.reason};}
 if(!result.data.session)return {error:'',success:'Registration request received. Check your email (and Spam/Junk) for a verification link before signing in.',retryAfterSeconds:0,reason:''};
 redirect('/onboarding');
}
