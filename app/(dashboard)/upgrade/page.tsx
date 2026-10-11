import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {essentialCapabilities,paidCapabilities} from '@/lib/plan-catalog';
import {billingReady} from '@/lib/server/billing';
import {PlanCheckoutForm} from './checkout-form';
export const dynamic='force-dynamic';
type Plan={id:string;name:string;price_monthly_ngn:number|null;price_yearly_ngn:number|null;description:string|null};
type PublishedPlanFeature={plan_id:string;feature_key:string};
export default async function UpgradePage({searchParams}:{searchParams:Promise<{checkout?:string}>}){
 const {client,businessId,role}=await getWorkspace();
 const [{data:plans,error:plansError},{data:assignment,error:assignmentError},{data:access},{data:payments}]=await Promise.all([
  client.from('public_site_plans').select('id,name,description,price_monthly_ngn,price_yearly_ngn').eq('published',true).order('sort_order'),
  client.from('business_plan_assignments').select('plan_id,expires_at').eq('business_id',businessId).maybeSingle(),
  client.rpc('published_plan_features'),
  client.from('business_subscription_payments').select('reference,plan_id,status,paid_at,paid_until,amount_kobo,billing_cycle').eq('business_id',businessId).order('created_at',{ascending:false}).limit(10)
 ]);
 const brandPlans=(plans||[]) as Plan[];
 const permissions=(Array.isArray(access)?access:[]) as PublishedPlanFeature[];
 const current=assignment?.plan_id;
 const expired=!!assignment?.expires_at && new Date(assignment.expires_at)<=new Date();
 const message=(await searchParams).checkout;
 const gateway=billingReady();
 return <main className="tax-page"><div className="page-head"><div><h1>Your plan & billing</h1><p>Choose what works for your business. Paid plans activate automatically after a successful payment.</p></div><Link href="/pricing" className="btn">Compare plans</Link></div>
 {message==='success'&&<div className="notice" role="status">Your payment was verified and your plan is active. You can start using its features now.</div>}
 {message&&message!=='success'&&<div className="notice" role="status">{message==='pending'?'Payment is still being confirmed. Your current plan has not changed.':message==='owner'?'Only the business owner can pay for a subscription.':message==='switch'?'Your existing paid plan is still active. Changing to another plan will be available when that billing period ends.':message==='unavailable'?'Online plan payments are temporarily unavailable. Please try again later.':'We could not start or confirm that payment. Your current plan has not changed.'}</div>}
 <section className="card card-pad" style={{margin:'20px 0'}}><h2>Current subscription</h2>{assignmentError?<p role="alert">We could not confirm your subscription. Please try again.</p>:<><p className="plan-current-status">{brandPlans.find(p=>p.id===current)?.name|| (current==='free'?'Free':'Your plan')} {expired?' · Renewal due':' · Active'}</p>{assignment?.expires_at&&<p className="small muted">{expired?'Previous access ended':'Current period ends'} {new Date(assignment.expires_at).toLocaleDateString('en-NG')}</p>}{current==='free'&&<p className="small muted">You can use the business essentials included with Free without contacting an administrator.</p>}</>}</section>
 <div className="grid grid-3 bo-plan-grid">{brandPlans.map(plan=>{
  const active=current===plan.id&&!expired;const samePlan=current===plan.id;
  const monthly=plan.price_monthly_ngn==null?null:Number(plan.price_monthly_ngn);
  const yearly=plan.price_yearly_ngn==null?null:Number(plan.price_yearly_ngn);
  const price=(n:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(n);
  return <section className="card card-pad" key={plan.id}><h2>{plan.name}</h2><p className="bo-plan-price">{plan.id==='free'?'Free forever':monthly!=null&&monthly>0?`${price(monthly)}/month`:yearly!=null&&yearly>0?`${price(yearly)}/year`:'Pricing not available'}</p><p className="small muted">{plan.description}</p><h3>Included tools</h3><ul>{essentialCapabilities.map(x=><li key={x.key}>{x.name}</li>)}</ul>{permissions.some(p=>p.plan_id===plan.id)&&<><h3>More features</h3><ul>{paidCapabilities.filter(x=>permissions.some(p=>p.plan_id===plan.id&&p.feature_key===x.key)).map(x=><li key={x.key}>{x.name}</li>)}</ul></>}
 {active?<strong className="positive">Your current plan</strong>:plan.id==='free'?<p className="small muted">Included automatically when you create your business.</p>:role!=='owner'?<p className="small muted">Your business owner manages your subscription.</p>:!gateway?<p className="small muted">Online checkout will be available soon.</p>:monthly==null&&yearly==null?<p className="small muted">This plan is not available for online purchase yet.</p>:<PlanCheckoutForm planId={plan.id} monthly={monthly} yearly={yearly} disabled={!!plansError||!!assignmentError}/>}</section>})}</div>
 {plansError&&<div className="notice" role="alert">Plans are temporarily unavailable. Please try again shortly.</div>}
 {role==='owner'&&!!payments?.length&&<section className="card card-pad" style={{marginTop:20}}><h2>Payment history</h2><div className="table-wrap"><table className="table"><thead><tr><th>Plan</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payments.map(p=><tr key={p.reference}><td>{brandPlans.find(v=>v.id===p.plan_id)?.name||p.plan_id}</td><td>{p.billing_cycle}</td><td>{new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(p.amount_kobo/100)}</td><td>{p.status==='paid'?'Paid':p.status==='failed'?'Failed':'Awaiting payment'}</td></tr>)}</tbody></table></div></section>}
 </main>;
}
