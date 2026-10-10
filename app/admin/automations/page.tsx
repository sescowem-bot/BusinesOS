import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {AutomationReviewForm} from './review-form';
import {AutomationRuleForm} from './rule-form';
export const dynamic='force-dynamic';
type Rule={id:string;request_id:string;message:string;cadence_hours:number;max_runs:number;run_count:number;next_run_at:string;enabled:boolean};
export default async function PlatformAutomations(){
 const session=await requirePlatformAdmin();if(!session)return <main><h1>Administrator access required</h1><Link href="/login">Login</Link></main>;
 const [requests,directory,rules,runs,emailJobs]=await Promise.all([
  session.client.from('business_automation_requests').select('id,business_id,title,details,category,delivery_channel,status,quote_note,admin_note,created_at').order('created_at',{ascending:false}).limit(100),
  session.client.rpc('platform_business_directory'),
  session.client.from('business_automation_rules').select('id,request_id,message,cadence_hours,max_runs,run_count,next_run_at,enabled').limit(100),
  session.client.from('business_automation_runs').select('id,scheduled_for,status,reason,created_at').order('created_at',{ascending:false}).limit(35),
  session.client.from('business_automation_email_jobs').select('id,created_at,status,attempts,last_error').order('created_at',{ascending:false}).limit(35)
 ]);
 const names=new Map(((directory.data||[]) as {business_id:string;business_name:string}[]).map(b=>[b.business_id,b.business_name]));
 const byRequest=new Map(((rules.data||[]) as Rule[]).map(r=>[r.request_id,r]));
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / AUTOMATION</span><h1>Automation Studio</h1><p>Review service requests, quote projects, and activate scheduled internal reminders after customer approval.</p></div><Link className="btn" href="/admin/businesses">Business directory →</Link></header>
 <section className="card card-pad" style={{marginBottom:18}}><h2>Execution controls</h2><p className="small muted">Creating a rule does not send messages. Admin activation, the protected scheduler, and explicit email configuration are separate safeguards. Task reminders are the only executable category in this release. Other requests remain review-only.</p><p><strong>Server scheduling:</strong> {process.env.ENABLE_AUTOMATION_RUNS==='true'?'Configured ON':'OFF'} · <strong>Resend automation:</strong> {process.env.ENABLE_AUTOMATION_EMAIL_DELIVERY==='true'&&process.env.ENABLE_PLATFORM_EMAIL_DELIVERY==='true'?'Configured ON':'OFF'}</p></section>
 {(requests.error||directory.error||rules.error)&&<section className="card card-pad" role="alert">Automation data unavailable. Confirm migration 029 and 030, then check Administrator permissions.</section>}
 <section className="grid grid-2">{!requests.error&&(requests.data||[]).map(r=>{
  const rule=byRequest.get(r.id);
  return <article className="card card-pad" key={r.id}><p className="small muted">{names.get(r.business_id)||r.business_id} · {r.category.replaceAll('_',' ')} · {new Date(r.created_at).toLocaleDateString('en-NG')}</p><h2>{r.title}</h2><p>{r.details}</p><p className="small muted">Delivery preference: {r.delivery_channel} · Request: <strong>{r.status}</strong></p>{r.quote_note&&<p><strong>Quotation:</strong> {r.quote_note}</p>}{r.admin_note&&<p className="small muted"><strong>Admin note:</strong> {r.admin_note}</p>}{['requested','quoted','accepted'].includes(r.status)&&<AutomationReviewForm requestId={r.id} status={r.status}/>} {r.status==='configured'&&r.category==='task_reminders'&&<AutomationRuleForm key={rule?.id||r.id} requestId={r.id} title={r.title} existing={rule||null}/>} {r.status==='configured'&&r.category!=='task_reminders'&&<p className="small muted">This category requires a separately tested workflow before execution can be enabled.</p>}</article>;
 })}{!requests.error&&!requests.data?.length&&<section className="card card-pad">No automation requests yet.</section>}</section>
 <section className="grid grid-2" style={{marginTop:22}}>
  <div className="card card-pad"><h2>Recent scheduled executions</h2>{runs.error?<p role="alert">Execution history unavailable. Apply migration 030.</p>:(runs.data||[]).map(r=><p key={r.id} className="small">{new Date(r.scheduled_for).toLocaleString('en-GB',{timeZone:'UTC'})} UTC · <strong>{r.status}</strong>{r.reason?` · ${r.reason}`:''}</p>)}{!runs.error&&!runs.data?.length&&<p className="muted">No scheduled executions yet.</p>}</div>
  <div className="card card-pad"><h2>Resend queue and delivery status</h2>{emailJobs.error?<p role="alert">Email jobs unavailable. Apply migration 030.</p>:(emailJobs.data||[]).map(j=><p key={j.id} className="small">{new Date(j.created_at).toLocaleString('en-GB',{timeZone:'UTC'})} UTC · <strong>{j.status}</strong> · {j.attempts} attempt(s){j.last_error?` · ${j.last_error}`:''}</p>)}{!emailJobs.error&&!emailJobs.data?.length&&<p className="muted">No automation email jobs queued.</p>}</div>
 </section></main>;
}
