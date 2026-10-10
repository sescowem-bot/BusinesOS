import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {sendViaConfiguredResend} from '@/lib/notifications-email';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

type EmailJob={id:string;run_id:string;recipient_id:string;subject:string;body:string;claim_token:string};
function authorised(req:Request){
 const configured=process.env.AUTOMATION_RUNNER_SECRET||'';
 const supplied=req.headers.get('authorization')||'';
 if(configured.length<32||!supplied.startsWith('Bearer '))return false;
 const actual=Buffer.from(supplied.slice(7));const expected=Buffer.from(configured);
 return actual.length===expected.length && timingSafeEqual(actual,expected);
}

/** Called ONLY by a configured scheduler. No public or user-session invocation. */
export async function POST(req:Request){
 if(!authorised(req))return new NextResponse('Unauthorized',{status:401});
 if(process.env.ENABLE_AUTOMATION_RUNS!=='true')return new NextResponse('Automation worker disabled',{status:503});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return new NextResponse('Worker configuration incomplete',{status:503});
 const db=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:processed,error:runError}=await db.rpc('automation_process_due',{p_limit:20});
 if(runError){console.error('Automation schedule processing failed',runError.code);return new NextResponse('Scheduler unavailable',{status:503});}
 if(process.env.ENABLE_AUTOMATION_EMAIL_DELIVERY!=='true' || process.env.ENABLE_PLATFORM_EMAIL_DELIVERY!=='true'){
  return NextResponse.json({ok:true,processed,email:'disabled'});
 }
 const {data:claims,error:claimError}=await db.rpc('automation_claim_email_jobs',{p_limit:3});
 if(claimError){console.error('Automation job claim failed',claimError.code);return new NextResponse('Email queue unavailable',{status:503});}
 let accepted=0;let skipped=0;let retry=0;
 for(const job of (claims||[]) as EmailJob[]){
  let outcome:'accepted'|'skipped'|'retry'='retry';let providerId:string|null=null;let failure:string|null=null;
  try{
   const [{data:account,error:accountError},{data:pref,error:prefError},{data:membership,error:memberError}]=await Promise.all([
    db.auth.admin.getUserById(job.recipient_id),
    db.from('notification_preferences').select('email_business').eq('user_id',job.recipient_id).maybeSingle(),
    db.from('business_automation_email_jobs').select('business_id').eq('id',job.id).single()
   ]);
   if(accountError||prefError||memberError||!membership){failure='recipient_lookup_failed';}
   else if(!account.user?.email||!account.user.email_confirmed_at||pref?.email_business===false){outcome='skipped';failure='recipient_not_verified_or_opted_out';}
   else{
    // Membership remains checked at send-time, even if the business owner changed after queueing.
    const {data:owner,error:ownerError}=await db.from('business_members').select('user_id')
     .eq('business_id',membership.business_id).eq('user_id',job.recipient_id).eq('role','owner').maybeSingle();
    if(ownerError){failure='membership_lookup_failed';}
    else if(!owner){outcome='skipped';failure='recipient_no_longer_owner';}
    else{
     const sent=await sendViaConfiguredResend({recipient:account.user.email,subject:job.subject,heading:job.subject,body:job.body,buttonLabel:'View your automation',actionUrl:'/automations/requests'},`automation-${job.run_id}`);
     if(sent.ok){outcome='accepted';providerId=sent.providerId||null;}
     else failure=sent.error||'resend_failed';
    }
   }
  }catch{failure='delivery_exception';}
  const {data:finished,error:finishError}=await db.rpc('automation_finish_email_job',{
   p_id:job.id,p_token:job.claim_token,p_outcome:outcome,p_provider_id:providerId,p_error:failure
  });
  if(finishError || finished!==true){console.error('Automation completion record failed',finishError?.code||'claim_expired');continue;}
  if(outcome==='accepted')accepted++;
  else if(outcome==='skipped')skipped++;
  else retry++;
 }
 return NextResponse.json({ok:true,processed,email:{claimed:(claims||[]).length,accepted,skipped,retry}});
}
