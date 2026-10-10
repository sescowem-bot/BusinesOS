import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {verifyResendSignature} from '@/lib/server/email-webhook-verification';
export const runtime='nodejs';
export const dynamic='force-dynamic';

type ResendEvent={type?:string;data?:{email_id?:string}};
export async function POST(req:Request){
 const signingSecret=process.env.RESEND_WEBHOOK_SECRET;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!signingSecret||!url||!key)return new NextResponse('Not configured',{status:503});
 const raw=await req.text();
 if(raw.length>100_000)return new NextResponse('Payload too large',{status:413});
 if(!verifyResendSignature(raw,req.headers,signingSecret))return new NextResponse('Invalid signature',{status:401});
 let event:ResendEvent;
 try{event=JSON.parse(raw) as ResendEvent}catch{return new NextResponse('Invalid JSON',{status:400})}
 const eventId=req.headers.get('svix-id')||'',providerId=event.data?.email_id;
 if(!providerId || providerId.length>200 || !/^email\.[a-z_]+$/.test(event.type||''))return new NextResponse('Ignored',{status:200});
 const service=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 if(!['email.delivered','email.bounced','email.complained'].includes(event.type||''))return new NextResponse('Ignored',{status:200});
 // A single database transaction deduplicates webhook retries and updates delivery state.
 const {error}=await service.rpc('record_resend_delivery_event',{
  p_event_id:eventId,p_event_type:event.type,p_provider_message_id:providerId
 });
 if(error)return new NextResponse('Unable to record signed delivery event',{status:503});
 // Optional Phase 030D automation delivery tracking; earlier installations remain supported.
 const {error:automationError}=await service.rpc('automation_record_resend_event',{
  p_provider_id:providerId,p_event_type:event.type
 });
 if(automationError && !['PGRST202','42883'].includes(automationError.code||''))
  return new NextResponse('Automation delivery status unavailable',{status:503});
 return new NextResponse('OK',{status:200});
}
