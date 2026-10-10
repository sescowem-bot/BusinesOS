'use server';
import {getServerSupabase} from '@/lib/server/supabase';
export type ResetState={message:string};
export async function requestReset(_state:ResetState,form:FormData):Promise<ResetState>{
 const email=String(form.get('email')||'').trim().toLowerCase();
 if(!/^\S+@\S+\.\S+$/.test(email))return {message:'Enter a valid email address.'};
 const client=await getServerSupabase();if(!client)return {message:'Password recovery has not been configured.'};
 const site=process.env.NEXT_PUBLIC_SITE_URL||process.env.NEXT_PUBLIC_APP_URL;
 if(!site)return {message:'Password recovery redirect URL is not configured.'};
 await client.auth.resetPasswordForEmail(email,{redirectTo:`${site.replace(/\/$/,'')}/auth/callback?next=/reset-password`});
 return {message:'If this address has an account, a reset link will be sent.'};
}
