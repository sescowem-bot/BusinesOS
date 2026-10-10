'use server';
import {redirect} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';
import {cookies} from 'next/headers';
import {ACTIVE_BUSINESS_COOKIE} from '@/lib/server/workspace-selection';
import {explainAuthError} from '@/lib/auth-feedback';
export type LoginState={error:string;retryAfterSeconds:number;reason:string};
const fail=(error:string):LoginState=>({error,retryAfterSeconds:0,reason:'general'});
export async function signIn(_previous:LoginState,form:FormData):Promise<LoginState>{
 const email=String(form.get('email')||'').trim().toLowerCase(),password=String(form.get('password')||'');
 if(!email||!password)return fail('Enter your email and password.');
 const supabase=await getServerSupabase();
 if(!supabase)return fail('Sign in is temporarily unavailable. Please contact BusinessOS support.');
 let result;
 try{result=await supabase.auth.signInWithPassword({email,password})}
 catch{return fail('Could not reach the sign-in service. Check your connection and try again.');}
 if(result.error){const feedback=explainAuthError(result.error,'login');return {error:feedback.message,retryAfterSeconds:feedback.retryAfterSeconds,reason:feedback.reason};}
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return fail('Your sign-in session could not be verified. Please try again.');
 const {data:admin,error:adminError}=await supabase.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle();
 if(adminError)return fail('Signed in, but account permissions are temporarily unavailable. Please refresh the page.');
 if(admin)redirect('/admin');
 const {data:member,error:memberError}=await supabase.from('business_members').select('business_id').eq('user_id',user.id).limit(1);
 if(memberError)return fail('Signed in, but your business workspace is temporarily unavailable. Please refresh the page.');
 if(member?.length)redirect('/dashboard');
 redirect('/onboarding');
}
export async function signOut(){const supabase=await getServerSupabase();if(supabase)await supabase.auth.signOut();(await cookies()).delete(ACTIVE_BUSINESS_COOKIE);redirect('/login');}
