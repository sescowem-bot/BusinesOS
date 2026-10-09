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
 redirect('/dashboard');
}
export async function signOut(){const supabase=await getServerSupabase();if(supabase)await supabase.auth.signOut();redirect('/login');}
