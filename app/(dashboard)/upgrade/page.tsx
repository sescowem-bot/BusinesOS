import {getWorkspace} from '@/lib/server/workspace';
import {UpgradeRequestForm} from './request-form';
export const dynamic='force-dynamic';
type Plan={id:string;name:string;description:string|null;price_label:string|null;billing_label:string|null;features:unknown};
type Request={id:string;plan_id:string;status:string;requested_at:string;review_note:string|null};
export default async function UpgradePage(){
 const {client,businessId,role}=await getWorkspace();
 const [plans,requests,assignments]=await Promise.all([
  client.from('public_site_plans').select('id,name,description,price_label,billing_label,features').eq('published',true).order('sort_order'),
  client.from('business_upgrade_requests').select('id,plan_id,status,requested_at,review_note').eq('business_id',businessId).order('requested_at',{ascending:false}).limit(15),
  client.from('business_plan_assignments').select('plan_id,approved_at').eq('business_id',businessId).maybeSingle()
 ]);
 const planRows=(Array.isArray(plans.data)?plans.data:[]) as Plan[];
 const requestRows=(Array.isArray(requests.data)?requests.data:[]) as Request[];
 const pending=requestRows.some(r=>r.status==='pending');
 const errors=[plans.error&&'pricing plans',requests.error&&'request history',assignments.error&&'current plan'].filter(Boolean);
 const nameFor=(id:string)=>planRows.find(p=>p.id===id)?.name||id;
 const featuresOf=(input:unknown)=>Array.isArray(input)?input.filter((v):v is string=>typeof v==='string'):[];
 const current=assignments.data?.plan_id;
 return <div className="tax-page"><p className="small muted">BUSINESS / SUBSCRIPTION</p><h1>Plans & upgrades</h1><p className="muted">Plan changes are subject to platform administrator approval. No online payment is processed on this page.</p>
 {errors.length>0&&<section className="tax-panel" role="alert"><strong>Some subscription information could not be loaded.</strong><p className="small muted">Unavailable: {errors.join(', ')}. No plan has been changed. Contact platform support if the issue continues.</p></section>}
 <section className="tax-panel"><h2>Current plan</h2><p>{assignments.error?'Cannot verify current plan':current?nameFor(current):'No approved plan assigned yet'}</p><h3>Request history</h3>
 {requests.error?<p role="alert">History is unavailable; you cannot safely submit another request yet.</p>:requestRows.length?requestRows.map(r=><p key={r.id}><strong>{nameFor(r.plan_id)}</strong> — {r.status}<span className="small muted"> · {Number.isNaN(new Date(r.requested_at).getTime())?'Date unavailable':new Date(r.requested_at).toLocaleDateString('en-NG')}</span>{r.review_note&&<span> · {r.review_note}</span>}</p>):<p className="muted">No previous requests.</p>}</section>
 <div className="grid grid-3">{planRows.map(plan=><section className="tax-panel" key={plan.id}><h2>{plan.name}</h2><p>{plan.price_label||'Contact sales'} {plan.billing_label||''}</p><p>{plan.description||''}</p><ul>{featuresOf(plan.features).map((item,i)=><li key={i}>{item}</li>)}</ul>
 {role==='owner'?<UpgradeRequestForm planId={plan.id} disabled={pending||current===plan.id||Boolean(errors.length)}/>:<p className="muted small">Only the business owner can request a plan change.</p>}
 {current===plan.id&&<p className="small muted">Your current approved plan</p>}
 </section>)}{!planRows.length&&!plans.error&&<p>No published plans are currently available. Contact platform support.</p>}</div></div>;
}
