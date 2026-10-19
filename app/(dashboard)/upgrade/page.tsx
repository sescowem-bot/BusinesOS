import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {essentialCapabilities,releasedPaidCapabilities} from '@/lib/plan-catalog';
import {billingReady} from '@/lib/server/billing';
import {PlanCheckoutForm} from './checkout-form';
import {UpgradeRequestForm} from './request-form';
export const dynamic='force-dynamic';
type Plan={id:string;name:string;price_monthly_ngn:number|null;price_yearly_ngn:number|null;description:string|null};
type PublishedPlanFeature={plan_id:string;feature_key:string};
export default async function UpgradePage({searchParams}:{searchParams:Promise<{checkout?:string}>}){
 const {client,businessId,role}=await getWorkspace();
 const [{data:plans,error:plansError},{data:assignment,error:assignmentError},{data:access},{data:payments},{data:requests,error:requestsError}]=await Promise.all([
  client.from('public_site_plans').select('id,name,description,price_monthly_ngn,price_yearly_ngn').eq('published',true).order('sort_order'),
  client.from('business_plan_assignments').select('plan_id,expires_at').eq('business_id',businessId).maybeSingle(),
  client.rpc('published_plan_features'),
  client.from('business_subscription_payments').select('reference,plan_id,status,paid_at,paid_until,amount_kobo,billing_cycle').eq('business_id',businessId).order('created_at',{ascending:false}).limit(10),
  client.from('business_upgrade_requests').select('id,plan_id,status,requested_at,review_note').eq('business_id',businessId).order('requested_at',{ascending:false}).limit(15)
 ]);
 const brandPlans=(plans||[]) as Plan[];
 const permissions=(Array.isArray(access)?access:[]) as PublishedPlanFeature[];
 const current=assignment?.plan_id;
 const expired=!!assignment?.expires_at && new Date(assignment.expires_at)<=new Date();
 const message=(await searchParams).checkout;
 const gateway=billingReady();
 const owner=role==='owner';
 const pending=(requests||[]).some(x=>x.status==='pending');
 return <main className="tax-page"><div className="page-head"><div><h1>Plan &amp; billing</h1><p>Compare plans, make an upgrade request, or pay securely where available.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link href="/settings" className="btn">Business settings</Link><Link href="/pricing" className="btn">Compare plans</Link></div></div>
 {message==='success'&&<div className="notice" role="status">Your payment was verified and your plan is active. You can start using its features now.</div>}
 {message&&message!=='success'&&<div className="notice" role="status">{message==='pending'?'Payment is still being confirmed. Your current plan has not changed.':message==='owner'?'Only the business owner can pay for a subscription.':message==='switch'?'Your existing paid plan is still active. Changing to another plan will be available when that billing period ends.':message==='unavailable'?'Online plan payments are temporarily unavailable. Please try again later.':'We could not start or confirm that payment. Your current plan has not changed.'}</div>}
 <section className="card card-pad" style={{margin:'20px 0'}}><h2>Current subscription</h2>{assignmentError?<p role="alert">We could not confirm your subscription. Please try again.</p>:<><p className="plan-current-status">{brandPlans.find(p=>p.id===current)?.name|| (current==='free'?'Free':'Your plan')} {expired?' · Renewal due':' · Active'}</p>{assignment?.expires_at&&<p className="small muted">{expired?'Previous access ended':'Current period ends'} {new Date(assignment.expires_at).toLocaleDateString('en-NG')}</p>}{current==='free'&&<p className="small muted">You can use the business essentials included with Free without contacting an administrator.</p>}</>}</section>
 <div className="grid grid-3 bo-plan-grid">{brandPlans.map(plan=>{
  const active=current===plan.id&&!expired;const samePlan=current===plan.id;
  const monthly=plan.price_monthly_ngn==null?null:Number(plan.price_monthly_ngn);
  const yearly=plan.price_yearly_ngn==null?null:Number(plan.price_yearly_ngn);
  const price=(n:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(n);
  return <section className="card card-pad" key={plan.id}><h2>{plan.name}</h2><p className="bo-plan-price">{plan.id==='free'?'Free forever':monthly!=null&&monthly>0?`${price(monthly)}/month`:yearly!=null&&yearly>0?`${price(yearly)}/year`:'Contact us for pricing'}</p><p className="small muted">{plan.description}</p><h3>Business essentials</h3><ul>{essentialCapabilities.map(x=><li key={x.key}>{x.name}</li>)}</ul>{permissions.some(p=>p.plan_id===plan.id)&&<><h3>Included with this plan</h3><ul>{releasedPaidCapabilities.filter(x=>permissions.some(p=>p.plan_id===plan.id&&p.feature_key===x.key)).map(x=><li key={x.key}>{x.name}</li>)}</ul></>}
 {active?<strong className="positive">Your current plan</strong>:plan.id==='free'?<p className="small muted">Included automatically when you create your business.</p>:role!=='owner'?<p className="small muted">Your business account administrator manages subscriptions.</p>:<div className="bo-upgrade-options">{gateway&&(monthly!=null&&monthly>0||yearly!=null&&yearly>0)&&<PlanCheckoutForm planId={plan.id} monthly={monthly} yearly={yearly} disabled={!!plansError||!!assignmentError}/>}<div style={{marginTop:16,paddingTop:14,borderTop:'1px solid #e0e8ed'}}><h4>Request this plan</h4><p className="small muted">Send a request for our team to review. No payment is taken when you submit it.</p><UpgradeRequestForm planId={plan.id} disabled={pending||!!requestsError||!!plansError||!!assignmentError}/>{pending&&<p className="small muted">You already have a request under review.</p>}</div></div>}</section>})}</div>
 {plansError&&<div className="notice" role="alert">Plans are temporarily unavailable. Please try again shortly.</div>}
 {owner&&<section className="card card-pad" style={{marginTop:20}}><h2>Your upgrade requests</h2>{requestsError?<p role="alert">We couldn't load your requests. Please refresh the page.</p>:!requests?.length?<p className="muted">You have no upgrade requests yet.</p>:<div className="table-wrap"><table className="table"><thead><tr><th>Plan</th><th>Requested</th><th>Status</th><th>Reply</th></tr></thead><tbody>{requests.map(r=><tr key={r.id}><td>{brandPlans.find(p=>p.id===r.plan_id)?.name||r.plan_id}</td><td>{new Date(r.requested_at).toLocaleDateString('en-NG')}</td><td>{r.status==='pending'?'Under review':r.status==='approved'?'Accepted':r.status==='rejected'?'Declined':'Cancelled'}</td><td>{r.review_note||'Our team will respond here.'}</td></tr>)}</tbody></table></div>}</section>}
 {role==='owner'&&!!payments?.length&&<section className="card card-pad" style={{marginTop:20}}><h2>Payment history</h2><div className="table-wrap"><table className="table"><thead><tr><th>Plan</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payments.map(p=><tr key={p.reference}><td>{brandPlans.find(v=>v.id===p.plan_id)?.name||p.plan_id}</td><td>{p.billing_cycle}</td><td>{new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(p.amount_kobo/100)}</td><td>{p.status==='paid'?'Paid':p.status==='failed'?'Failed':'Awaiting payment'}</td></tr>)}</tbody></table></div></section>}
 </main>;
}
