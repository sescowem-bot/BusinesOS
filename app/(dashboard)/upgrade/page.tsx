import {getWorkspace} from '@/lib/server/workspace';
import {UpgradeRequestForm} from './request-form';
import {essentialCapabilities,paidCapabilities} from '@/lib/plan-catalog';
export const dynamic='force-dynamic';
type Plan={id:string;name:string;description:string|null;price_label:string|null;billing_label:string|null;features:unknown};
type Request={id:string;plan_id:string;status:string;requested_at:string;review_note:string|null};
type PublishedPlanFeature={plan_id:string;feature_key:string};
function isPublishedPlanFeature(value:unknown):value is PublishedPlanFeature{
 if(typeof value!=='object'||value===null)return false;
 const row=value as Record<string,unknown>;
 return typeof row.plan_id==='string'&&typeof row.feature_key==='string';
}
export default async function UpgradePage(){
 const {client,businessId,role}=await getWorkspace();
 const [plans,requests,assignments,access,grantsResult]=await Promise.all([
  client.from('public_site_plans').select('id,name,description,price_label,billing_label,features').eq('published',true).order('sort_order'),
  client.from('business_upgrade_requests').select('id,plan_id,status,requested_at,review_note').eq('business_id',businessId).order('requested_at',{ascending:false}).limit(15),
  client.from('business_plan_assignments').select('plan_id,approved_at').eq('business_id',businessId).maybeSingle(),
  client.rpc('published_plan_features'),
  client.from('business_feature_grants').select('feature_key,enabled,expires_at,allowed_roles').eq('business_id',businessId)
 ]);
 const planRows=(Array.isArray(plans.data)?plans.data:[]) as Plan[];
 const requestRows=(Array.isArray(requests.data)?requests.data:[]) as Request[];
 const availableFeatures:PublishedPlanFeature[]=((Array.isArray(access.data)?access.data:[]) as unknown[]).filter(isPublishedPlanFeature);
 const pending=requestRows.some(r=>r.status==='pending');
 const errors=[plans.error&&'pricing plans',requests.error&&'request history',assignments.error&&'current plan',access.error&&'additional feature access'].filter(Boolean);
 const nameFor=(id:string)=>planRows.find(p=>p.id===id)?.name||id;
 const featuresOf=(input:unknown)=>Array.isArray(input)?input.filter((v):v is string=>typeof v==='string'):[];
 const current=assignments.data?.plan_id;
 return <div className="tax-page"><p className="small muted">BUSINESS / SUBSCRIPTION</p><h1>Plans & upgrades</h1><p className="muted">Plan changes are subject to platform administrator approval. No online payment is processed on this page.</p>
 {errors.length>0&&<section className="tax-panel" role="alert"><strong>Some subscription information could not be loaded.</strong><p className="small muted">Unavailable: {errors.join(', ')}. No plan has been changed. Contact platform support if the issue continues.</p></section>}
 <section className="tax-panel"><h2>Current plan</h2><p className="plan-current-status">{assignments.error?'Cannot verify current plan':current?`${nameFor(current)}${current==='free'?' · Active at no cost':''}`:'Your Free plan is being set up automatically. Refresh soon or contact support if this continues.'}</p>{current==='free'&&<p className="small muted">Your core business tools are available without requesting an upgrade. Paid modules remain optional.</p>}<h3>Request history</h3>
 {requests.error?<p role="alert">History is unavailable; you cannot safely submit another request yet.</p>:requestRows.length?requestRows.map(r=><p key={r.id}><strong>{nameFor(r.plan_id)}</strong> — {r.status}<span className="small muted"> · {Number.isNaN(new Date(r.requested_at).getTime())?'Date unavailable':new Date(r.requested_at).toLocaleDateString('en-NG')}</span>{r.review_note&&<span> · {r.review_note}</span>}</p>):<p className="muted">No previous requests.</p>}</section>
 <section className="tax-panel"><h2>Business-specific extras</h2><p className="small muted">The System Owner can approve extra access for this business without changing your subscription plan.</p>
 {grantsResult.error?<p>Cannot verify extra feature access. Contact support if this continues.</p>:<ul>{(grantsResult.data||[]).filter(g=>g.enabled&&(!g.expires_at||new Date(g.expires_at)>new Date())).map(g=><li key={g.feature_key}>{paidCapabilities.find(f=>f.key===g.feature_key)?.name||g.feature_key} · {g.expires_at?'Until '+new Date(g.expires_at).toLocaleDateString('en-NG'):'No expiry'}</li>)}{!(grantsResult.data||[]).some(g=>g.enabled&&(!g.expires_at||new Date(g.expires_at)>new Date()))&&<li>No extras currently active.</li>}</ul>}
 <a className="btn" href="/automations/requests">Request custom automation →</a></section>
 <div className="grid grid-3">{planRows.map(plan=><section className="tax-panel" key={plan.id}><h2>{plan.name}</h2><p>{plan.price_label||'Contact sales'} {plan.billing_label||''}</p><p>{plan.description||''}</p><h3>Included workspace tools</h3><ul>{essentialCapabilities.map(item=><li key={item.key}>{item.name}</li>)}</ul><h3>Additional modules</h3>{access.error?<p className="small muted">Cannot verify additional modules at this time.</p>:<ul>{paidCapabilities.filter(f=>availableFeatures.some(a=>a.plan_id===plan.id&&a.feature_key===f.key)).map(f=><li key={f.key}>{f.name}</li>)}</ul>}{!access.error&&!availableFeatures.some(a=>a.plan_id===plan.id)&&<p className="small muted">No additional modules enabled.</p>}{featuresOf(plan.features).length>0&&<details><summary>Additional plan notes</summary><ul>{featuresOf(plan.features).map((item,i)=><li key={i}>{item}</li>)}</ul></details>}
 {plan.id==='free'?<p className="small muted">Free access is assigned automatically when you create a business. No request or payment needed.</p>:role==='owner'?<UpgradeRequestForm planId={plan.id} disabled={pending||current===plan.id||Boolean(errors.length)}/>:<p className="muted small">Only the business owner can request a plan change.</p>}
 {current===plan.id&&<p className="small muted">Your current approved plan</p>}
 </section>)}{!planRows.length&&!plans.error&&<p>No published plans are currently available. Contact platform support.</p>}</div></div>;
}
