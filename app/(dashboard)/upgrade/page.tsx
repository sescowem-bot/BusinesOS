import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {essentialCapabilities,releasedPaidCapabilities} from '@/lib/plan-catalog';
import {billingReady} from '@/lib/server/billing';
import {PlanCheckoutForm} from './checkout-form';
import {requestedPaidPlan} from '@/lib/plan-selection';
export const dynamic='force-dynamic';
type Plan={id:string;name:string;price_monthly_ngn:number|null;price_yearly_ngn:number|null;description:string|null};
type PublishedPlanFeature={plan_id:string;feature_key:string};
type Payment={reference:string;plan_id:string;status:string;amount_kobo:number;billing_cycle:string};
const formatMoney=(amount:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(amount);
export default async function UpgradePage({searchParams}:{searchParams:Promise<{checkout?:string;plan?:string}>}){
 const {client,businessId,role}=await getWorkspace();
 const owner=role==='owner';
 const [planResult,assignmentResult,accessResult,paymentResult,featuresResult]=await Promise.all([
  client.from('public_site_plans').select('id,name,description,price_monthly_ngn,price_yearly_ngn').eq('published',true).order('sort_order'),
  client.from('business_plan_assignments').select('plan_id,expires_at').eq('business_id',businessId).maybeSingle(),
  client.rpc('published_plan_features'),
  owner?client.from('business_subscription_payments').select('reference,plan_id,status,amount_kobo,billing_cycle').eq('business_id',businessId).order('created_at',{ascending:false}).limit(10):Promise.resolve({data:[],error:null}),
  client.rpc('business_workspace_features',{p_business:businessId})
 ]);
 const plans=(planResult.data||[]) as Plan[];
 const publishedFeatures=(Array.isArray(accessResult.data)?accessResult.data:[]) as PublishedPlanFeature[];
 const enabled=new Set<string>(Array.isArray(featuresResult.data)?featuresResult.data.filter((s):s is string=>typeof s==='string'):[]);
 const premiumPreviews=featuresResult.error?[]:releasedPaidCapabilities.filter(x=>!enabled.has(x.key)).slice(0,3);
 const current=assignmentResult.data?.plan_id;
 const expiresAt=assignmentResult.data?.expires_at;
 const expired=!!expiresAt&&new Date(expiresAt)<=new Date();
 const {checkout,plan}=await searchParams;
 const selected=plans.find(x=>x.id===requestedPaidPlan(plan));
 const paymentAvailable=billingReady();
 const blocked=!!planResult.error||!!assignmentResult.error||!!accessResult.error||!!paymentResult.error;
 return <main className="tax-page">
  <div className="page-head"><div><h1>Plans &amp; secure billing</h1><p>Choose the plan that suits your business and pay securely with Paystack. No approval request is required.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn" href="/settings">Business settings</Link><Link className="btn" href="/pricing">Compare publicly</Link></div></div>
  {selected&&owner&&<div className="notice" role="status">You've selected <strong>{selected.name}</strong>. Choose monthly or annual billing below and continue to Paystack. You won't be charged until you confirm payment.</div>}
  {checkout==='success'&&<div className="notice" role="status">Paystack payment was verified and your subscription is active.</div>}
  {checkout&&checkout!=='success'&&<div className="notice" role="status">{checkout==='pending'?'Payment is being verified. Your existing access remains unchanged.':checkout==='owner'?'Only the business owner can pay for the subscription.':checkout==='switch'?'Your current paid term is active. To avoid losing the remaining term, changing plans is available after it expires.':checkout==='unavailable'?'Online payment is temporarily unavailable. No payment was taken. Please try again shortly.':'The payment could not be started or confirmed. Your current access has not changed.'}</div>}
  <section className="card card-pad" style={{margin:'20px 0'}}><h2>Current subscription</h2>{assignmentResult.error?<p role="alert">Your subscription could not be confirmed. No payment can be started until this is resolved.</p>:<><p className="plan-current-status">{plans.find(x=>x.id===current)?.name||(current==='free'?'Free':'Your plan')} {expired?' · Renewal due':' · Active'}</p>{expiresAt&&<p className="small muted">{expired?'Previous subscription expired':'Current term ends'} {new Date(expiresAt).toLocaleDateString('en-NG')}</p>}{current==='free'&&<p className="small muted">Your essential business tools are included on Free—no payment required.</p>}</>}</section>
  {!!premiumPreviews.length&&<section className="card card-pad" aria-label="Explore premium tools" style={{margin:'16px 0'}}><h2>Discover more possibilities</h2><p className="small muted">A preview of premium tools you could access with an eligible plan. Restricted tools remain protected until your subscription and staff permissions allow them.</p><div className="grid grid-3">{premiumPreviews.map(item=><article key={item.key} style={{padding:14,border:'1px solid #e0e7ed',borderRadius:12}}><p className="small muted">Premium feature</p><h3>{item.name}</h3><p className="small muted">{item.detail}</p>{owner?<a className="btn" href="#available-plans">Compare plans &amp; pay</a>:<p className="small muted">Ask the business owner about upgrading.</p>}</article>)}</div></section>}
  <div id="available-plans" className="grid grid-3 bo-plan-grid" style={{scrollMarginTop:90}}>{plans.map(item=>{
    const active=current===item.id&&!expired;
    const monthly=item.price_monthly_ngn==null?null:Number(item.price_monthly_ngn);
    const yearly=item.price_yearly_ngn==null?null:Number(item.price_yearly_ngn);
    const payPrice=(monthly!==null&&monthly>0)||(yearly!==null&&yearly>0);
    const included=releasedPaidCapabilities.filter(x=>publishedFeatures.some(f=>f.plan_id===item.id&&f.feature_key===x.key));
    return <section className="card card-pad" key={item.id} id={'plan-'+item.id} style={selected?.id===item.id?{border:'2px solid #158367',scrollMarginTop:90}:{}}>
     <h2>{item.name}</h2><p className="bo-plan-price">{item.id==='free'?'Free forever':monthly!==null&&monthly>0?formatMoney(monthly)+'/month':yearly!==null&&yearly>0?formatMoney(yearly)+'/year':'Pricing unavailable'}</p>
     <p className="small muted">{item.description}</p><h3>Always included</h3><ul>{essentialCapabilities.map(f=><li key={f.key}>{f.name}</li>)}</ul>
     {included.length>0&&<><h3>Additional features</h3><ul>{included.map(f=><li key={f.key}>{f.name}</li>)}</ul></>}
     {active?<strong className="positive">Your current plan</strong>:item.id==='free'?<p className="small muted">Free is included automatically when you create a workspace.</p>:!owner?<p className="small muted">Your business owner can purchase this plan. Staff cannot initiate charges.</p>:<div className="bo-upgrade-options">
      {paymentAvailable&&payPrice?<PlanCheckoutForm planId={item.id} monthly={monthly} yearly={yearly} disabled={blocked}/>:<p className="small muted" role="status">{paymentAvailable?'This plan does not have a valid online checkout price yet.':'Secure Paystack checkout is temporarily unavailable. No payment can be taken until it is configured.'}</p>}
     </div>}
    </section>
  })}</div>
  {(planResult.error||accessResult.error||featuresResult.error)&&<div className="notice" role="alert">Some plan features could not be verified. Please contact support if prices or benefits appear incomplete.</div>}
  {owner&&paymentResult.error&&<div className="notice" role="alert">Payment history is unavailable. New checkout is paused to prevent unverified transactions.</div>}
  {planResult.error&&<div className="notice" role="alert">Plans are temporarily unavailable. No payment was taken.</div>}
  {owner&&!!paymentResult.data?.length&&<section className="card card-pad" style={{marginTop:20}}><h2>Subscription payments</h2><p className="small muted">A payment updates your plan only after Paystack verification.</p><div className="table-wrap"><table className="table"><thead><tr><th>Plan</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead><tbody>{(paymentResult.data as Payment[]).map(p=><tr key={p.reference}><td>{plans.find(x=>x.id===p.plan_id)?.name||p.plan_id}</td><td>{p.billing_cycle}</td><td>{formatMoney(p.amount_kobo/100)}</td><td>{p.status==='paid'?'Paid':p.status==='failed'?'Failed':'Awaiting payment verification'}</td></tr>)}</tbody></table></div></section>}
 </main>;
}
