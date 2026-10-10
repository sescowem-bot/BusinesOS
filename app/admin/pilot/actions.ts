'use server';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {pilotCheckIds} from '@/lib/pilot-checklist';
export type PilotSaveResult={ok:boolean;message:string};
export async function recordPilotResult(_previous:PilotSaveResult,form:FormData):Promise<PilotSaveResult>{
 const session=await requirePlatformAdmin();
 if(!session)return {ok:false,message:'Active Platform Administrator access required.'};
 const testId=String(form.get('test_id')||'');
 const environment=String(form.get('environment')||'');
 const status=String(form.get('status')||'');
 const evidence=String(form.get('evidence')||'').trim();
 if(!pilotCheckIds.has(testId)||!['preview','production'].includes(environment)||!['not_tested','pass','fail','blocked'].includes(status))
  return {ok:false,message:'Invalid test or review status.'};
 if(evidence.length>3000||(status!=='not_tested'&&evidence.length<12))
  return {ok:false,message:'Provide a redacted test result, commit or log reference (12 to 3000 characters).'};
 const {error}=await session.client.rpc('platform_record_pilot_check',{
  p_test_id:testId,p_environment:environment,p_status:status,p_evidence:evidence
 });
 if(error)return {ok:false,message:error.code==='42883'||error.code==='42P01'?'Apply pilot migration 028 first.':'Unable to save. Check your administrator permission and database setup.'};
 revalidatePath('/admin/pilot');
 return {ok:true,message:'Review recorded in the pilot audit log.'};
}
