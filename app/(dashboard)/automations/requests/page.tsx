import {getWorkspace} from '@/lib/server/workspace';
import {AutomationRequestForm} from './request-form';
import {respondToQuote} from './actions';
export const dynamic='force-dynamic';
export default async function AutomationRequestsPage(){
 const {client,businessId,role}=await getWorkspace();
 if(role!=='owner')return <main className="tax-page"><h1>Automation requests</h1><p>Only the business owner may request or approve custom automation services.</p></main>;
 const [{data:requests,error},{data:rules,error:ruleError},{data:runs,error:runError}]=await Promise.all([
  client.from('business_automation_requests').select('id,title,category,details,delivery_channel,status,quote_note,created_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(100),
  client.from('business_automation_rules').select('id,request_id,enabled,run_count,max_runs,next_run_at,cadence_hours').eq('business_id',businessId).limit(100),
  client.from('business_automation_runs').select('id,scheduled_for,status,reason').eq('business_id',businessId).order('created_at',{ascending:false}).limit(35)
 ]);
 const byRequest=new Map((rules||[]).map(r=>[r.request_id,r]));
 return <main className="tax-page"><p className="small muted">WORKSPACE / SERVICES</p><h1>Automation Studio</h1><p className="muted">Request tailored reminders and other workflows. Quotations need your approval; no paid service is activated automatically.</p>
 {error&&<section className="card card-pad" role="alert">Automation requests unavailable. Confirm migration 029 and your business membership.</section>}
 {(ruleError||runError)&&<section className="card card-pad" role="alert">Reminder schedules or history unavailable. Confirm migration 030.</section>}
 <div className="grid grid-2"><AutomationRequestForm/><section className="card card-pad"><h2>Your requests</h2>{(requests||[]).map(r=>{
  const rule=byRequest.get(r.id);
  return <article key={r.id} style={{padding:'14px 0',borderBottom:'1px solid #e2e8ef'}}><p className="small muted">{new Date(r.created_at).toLocaleDateString('en-NG')} · {r.category.replaceAll('_',' ')} · {r.delivery_channel.replaceAll('_',' ')}</p><h3>{r.title}</h3><p>{r.details}</p><p><strong>Status: {r.status}</strong></p>{r.quote_note&&<p className="small"><strong>Quotation:</strong> {r.quote_note}</p>}{rule&&<p className="small"><strong>Scheduled reminder:</strong> {rule.enabled?'Active':'Paused'} · {rule.run_count}/{rule.max_runs} runs · Next {new Date(rule.next_run_at).toLocaleString('en-GB',{timeZone:'UTC'})} UTC</p>}
  {r.status==='quoted'&&<div style={{display:'flex',gap:10,flexWrap:'wrap'}}><form action={respondToQuote}><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="decision" value="accept"/><button className="btn btn-primary">Accept quotation</button></form><form action={respondToQuote}><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="decision" value="decline"/><button className="btn">Decline</button></form></div>}</article>;
 })}{!requests?.length&&!error&&<p className="muted">No requests yet. Submit one to get started.</p>}</section></div>
 <section className="card card-pad" style={{marginTop:18}}><h2>Your recent automation activity</h2>{!runError&&(runs||[]).map(r=><p key={r.id} className="small">{new Date(r.scheduled_for).toLocaleString('en-GB',{timeZone:'UTC'})} UTC · {r.status}{r.reason?` · ${r.reason}`:''}</p>)}{!runError&&!runs?.length&&<p className="small muted">No executions yet.</p>}</section>
 <p className="small muted">Only approved internal task reminders can execute in this release. Email delivery is optional and requires explicit activation and recipient preferences.</p></main>;
}
