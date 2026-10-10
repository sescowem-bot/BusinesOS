import {getWorkspace} from '@/lib/server/workspace';
import {AutomationRequestForm} from './request-form';
import {respondToQuote} from './actions';
export const dynamic='force-dynamic';
export default async function AutomationRequestsPage(){
 const {client,businessId,role}=await getWorkspace();
 if(role!=='owner')return <main className="tax-page"><h1>Automation requests</h1><p>Only the business owner may request or approve paid custom services.</p></main>;
 const {data,error}=await client.from('business_automation_requests').select('id,title,category,details,delivery_channel,status,quote_note,created_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(100);
 return <main className="tax-page"><p className="small muted">WORKSPACE / SERVICES</p><h1>Automation Studio</h1><p className="muted">Request tailored reminders, scheduled reports and other workflows. Quotes require your approval; no paid services activate automatically.</p>
 {error&&<section className="card card-pad" role="alert">Automation requests unavailable. Apply SQL migration 029 and verify your business membership.</section>}
 <div className="grid grid-2"><AutomationRequestForm/><section className="card card-pad"><h2>Your requests</h2>{(data||[]).map(r=><article key={r.id} style={{padding:'14px 0',borderBottom:'1px solid #e2e8ef'}}><p className="small muted">{new Date(r.created_at).toLocaleDateString('en-NG')} · {r.category.replaceAll('_',' ')} · {r.delivery_channel.replaceAll('_',' ')}</p><h3>{r.title}</h3><p>{r.details}</p><p><strong>Status: {r.status}</strong></p>{r.quote_note&&<p className="small"><strong>Quotation:</strong> {r.quote_note}</p>}{r.status==='quoted'&&<div style={{display:'flex',gap:10,flexWrap:'wrap'}}><form action={respondToQuote}><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="decision" value="accept"/><button className="btn btn-primary">Accept quotation</button></form><form action={respondToQuote}><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="decision" value="decline"/><button className="btn">Decline</button></form></div>}</article>)}{!data?.length&&!error&&<p className="muted">No requests yet. Submit one to get started.</p>}</section></div>
 <p className="small muted">A configured request is not the same as an active scheduled job. Dispatch, recipient consent and quota enforcement will be tested separately.</p></main>;
}
