import 'server-only';
import {createClient} from '@supabase/supabase-js';

export function billingReady(){return !!(process.env.PAYSTACK_SECRET_KEY&&process.env.SUPABASE_SERVICE_ROLE_KEY&&(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL));}
export function billingAdmin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Billing service not configured');
 return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
export type VerifiedPaystack={reference:string;amount:number;currency:string;id:number};
export async function verifyPaystackPayment(reference:string):Promise<VerifiedPaystack|null>{
 if(!/^[a-zA-Z0-9_-]{14,90}$/.test(reference)||!process.env.PAYSTACK_SECRET_KEY)return null;
 try{
  const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{
   headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`},cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)return null;
  const body=await response.json() as {status?:boolean;data?:{status?:string;reference?:string;amount?:number;currency?:string;id?:number}};
  const row=body.data;
  if(!body.status||!row||row.status!=='success'||row.reference!==reference||!Number.isSafeInteger(row.amount)||!Number.isSafeInteger(row.id)||row.currency!=='NGN')return null;
  return {reference,amount:row.amount!,currency:row.currency,id:row.id!};
 }catch{return null;}
}
export async function activateVerifiedPayment(payment:VerifiedPaystack):Promise<boolean>{
 const {data,error}=await billingAdmin().rpc('activate_paid_business_plan',{
  p_reference:payment.reference,p_amount_kobo:payment.amount,p_currency:payment.currency,p_provider_id:payment.id});
 if(error){console.error('[billing] activation failed',error.code);return false;}
 return data===true;
}
