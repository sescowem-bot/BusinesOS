'use server';
import {getServerSupabase} from '@/lib/server/supabase';
import {explainAuthError} from '@/lib/auth-feedback';
export type ResetState={message:string;retryAfterSeconds:number;rateLimited:boolean};
export async function requestReset(_state:ResetState,form:FormData):Promise<ResetState>{
 const email=String(form.get('email')||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {message:'Enter a valid email address.',retryAfterSeconds:0,rateLimited:false};
 const client=await getServerSupabase();
 if(!client)return {message:'Password recovery is temporarily unavailable. Please contact support.',retryAfterSeconds:0,rateLimited:false};
 const site=process.env.NEXT_PUBLIC_SITE_URL||process.env.NEXT_PUBLIC_APP_URL;
 if(!site||!/^https:\/\/[^/]+/.test(site))return {message:'Password recovery is temporarily unavailable. Please contact support.',retryAfterSeconds:0,rateLimited:false};
 try{
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${site.replace(/\/$/,'')}/auth/callback?next=/reset-password`});
  if(error){
   const feedback=explainAuthError(error,'recovery');
   if(feedback.reason==='rate_limit')return {message:feedback.message,retryAfterSeconds:feedback.retryAfterSeconds,rateLimited:true};
  }
 }catch{return {message:'Password recovery is temporarily unavailable. Please try again later.',retryAfterSeconds:0,rateLimited:false};}
 // Prevent account enumeration: always give the same success text for unknown addresses.
 return {message:'If an account exists for that address, a reset link will be sent. Check your inbox and Spam/Junk folder.',retryAfterSeconds:0,rateLimited:false};
}
