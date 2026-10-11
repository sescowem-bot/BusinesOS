import Link from 'next/link';
import {CheckCircle2,ArrowRight,LockKeyhole} from 'lucide-react';
import PublicNav from '@/components/public-nav';
import PublicFooter from '@/components/public-footer';
import {getPlatformBrand} from '@/lib/server/branding';
import {getPublishedPlans,getPublishedPlanCapabilities} from '@/lib/server/public-cms';
import {essentialCapabilities,releasedPaidCapabilities} from '@/lib/plan-catalog';
export const revalidate=60;
export default async function Pricing(){
 const [brand,plans,catalog]=await Promise.all([getPlatformBrand(),getPublishedPlans(),getPublishedPlanCapabilities()]);
 const groups=[...new Set(releasedPaidCapabilities.map(f=>f.group))];
 return <main id="site-main" className="marketing-site site-refresh"><PublicNav name={brand.name} logo={brand.logo_url} access={'guest'}/>
  <section className="marketing-section marketing-section-muted"><div className="marketing-container marketing-section-heading"><span className="marketing-kicker">PLANS & ACCESS</span><h1 className="public-page-title">The right tools for every stage of business.</h1><p>Compare exactly what each published subscription includes. Manage your day-to-day business on Free or choose more tools as your operations grow.</p></div></section>
  <section className="marketing-section plan-active-section" id="current-plans"><div className="marketing-container"><div className="site-section-top"><div><span className="marketing-kicker">CURRENTLY PUBLISHED</span><h2>Available business plans.</h2></div><p>Compare plans and prices published by the platform. Paid subscriptions activate after a verified checkout.</p></div><div className="public-pricing-grid plan-pricing-grid">{plans.length===0?<div className="marketing-feature"><h2>Subscription categories are available to explore.</h2><p>The System Owner has not published an active plan yet. Review the category guide above, then ask about current activation options.</p><Link href="/contact">Enquire about access →</Link></div>:plans.map(plan=>{
   const enabled=new Set(catalog.byPlan[plan.id]||[]);
   const active=releasedPaidCapabilities.filter(f=>enabled.has(f.key));
   return <article className="public-plan public-plan-detailed" key={plan.id}>
    <span className="marketing-kicker">{plan.billing_label||'SUBSCRIPTION'}</span><h2>{plan.name}</h2><p>{plan.description}</p><div className="public-plan-price">{plan.id==='free'?'₦0 · Free forever':plan.price_monthly_ngn!=null&&Number(plan.price_monthly_ngn)>0?`${new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(Number(plan.price_monthly_ngn))}/month`:plan.price_label&& !/^(contact (us|sales|admin)|pricing to be announced)$/i.test(plan.price_label.trim())?plan.price_label:'Pricing on request'}</div>{plan.id!=='free'&&plan.price_yearly_ngn!=null&&Number(plan.price_yearly_ngn)>0&&<p className="plan-price-note">{new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(Number(plan.price_yearly_ngn))}/year</p>}<p className="plan-price-note">You can review your plan before making a payment.</p>
    <Link className="marketing-btn-primary" href={plan.id==='free'?'/signup':'/upgrade'}>{plan.id==='free'?'Create free workspace':'Select plan'} <ArrowRight size={16}/></Link>
    <div className="plan-details-divider"/><h3>Everyday business essentials</h3><ul className="plan-capability-list">{essentialCapabilities.map(feature=><li key={feature.key}><CheckCircle2 size={17} aria-hidden="true"/><span title={feature.detail}>{feature.name}</span></li>)}</ul>
    <h3>Additional modules</h3>
    {!catalog.available?<p className="small muted" role="status">Additional modules cannot be displayed right now. Please try again soon.</p>:active.length===0?<p className="small muted">Essential business tools are included.</p>:groups.map(group=>{
     const entries=active.filter(f=>f.group===group);return entries.length?<div className="plan-feature-group" key={group}><strong>{group}</strong><ul className="plan-capability-list">{entries.map(f=><li key={f.key}><CheckCircle2 size={17} aria-hidden="true"/><span><strong>{f.name}</strong><small className="plan-benefit-detail">{f.detail}</small></span></li>)}</ul></div>:null;})}
    {!!plan.features.length&&<details className="plan-marketing-notes"><summary>Other plan details</summary><ul>{plan.features.map((f,i)=><li key={i}>{f}</li>)}</ul></details>}
   </article>})}</div>
   {plans.length>0&&<section className="plan-comparison" aria-label="Detailed module comparison"><div className="marketing-section-heading"><span className="marketing-kicker">DETAILED COMPARISON</span><h2>Compare the complete workspace.</h2><p>Core capabilities are available in every plan. Additional modules are included only where specified by the selected subscription.</p></div>
    <div className="plan-comparison-scroll"><table><thead><tr><th scope="col">Capabilities</th>{plans.map(p=><th scope="col" key={p.id}>{p.name}</th>)}</tr></thead><tbody>
     <tr><th colSpan={plans.length+1} scope="rowgroup">Core workspace</th></tr>
     {essentialCapabilities.map(feature=><tr key={feature.key}><th scope="row" title={feature.detail}>{feature.name}</th>{plans.map(p=><td key={p.id}><span className="plan-included">Included</span></td>)}</tr>)}
     <tr><th colSpan={plans.length+1} scope="rowgroup">Additional modules</th></tr>
     {releasedPaidCapabilities.map(feature=><tr key={feature.key}><th scope="row" title={feature.detail}>{feature.name}</th>{plans.map(p=><td key={p.id}>{!catalog.available?<span className="muted">Check</span>:(catalog.byPlan[p.id]||[]).includes(feature.key)?<span className="plan-included">Included</span>:<span className="muted" aria-label="Not included"><LockKeyhole size={16}/></span>}</td>)}</tr>)}
    </tbody></table></div>
    <p className="small muted">Feature availability follows the approved business plan. Staff roles may further restrict access. Only currently available subscription modules are shown. A business team member also needs the appropriate permission.</p>
   </section>}
  </div></section>
  <section className="marketing-final"><div className="marketing-container"><h2>Need a plan built around your operations?</h2><p>Our team can discuss the modules and staff permissions your business needs.</p><Link className="marketing-btn-primary" href="/contact">Speak with us <ArrowRight size={18}/></Link></div></section>
  <PublicFooter name={brand.name} tagline={brand.tagline} email={brand.support_email} phone={brand.support_phone} logo={brand.logo_url}/>
 </main>;
}
