'use server';
import {redirect} from 'next/navigation';
import {getServerSupabase} from '@/lib/server/supabase';
export type LoginState={error:string};
export async function signIn(_previous:LoginState,form:FormData):Promise<LoginState>{
 const email=String(form.get('email')||'').trim();const password=String(form.get('password')||'');
 if(!email||!password)return {error:'Enter your email and password.'};
 const supabase=await getServerSupabase();
 if(!supabase)return {error:'Authentication is not configured. Set Supabase environment variables.'};
 const {error}=await supabase.auth.signInWithPassword({email,password});
 if(error)return {error:'Unable to sign in. Check your credentials and account status.'};
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {error:'Session could not be verified. Please sign in again.'};
 const {data:admin}=await supabase.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle();
 if(admin)redirect('/admin');
 const {data:member}=await supabase.from('business_members').select('business_id').eq('user_id',user.id).limit(1);
 if(member?.length)redirect('/dashboard');
 redirect('/onboarding');
}
export async function signOut(){const supabase=await getServerSupabase();if(supabase)await supabase.auth.signOut();redirect('/login');}
