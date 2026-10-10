import {getViewerAccess} from '@/lib/server/viewer-access';
import Link from 'next/link';
import {CheckCircle2,ArrowRight,LockKeyhole} from 'lucide-react';
import PublicNav from '@/components/public-nav';
import PublicFooter from '@/components/public-footer';
import {getPlatformBrand} from '@/lib/server/branding';
import {getPublishedPlans,getPublishedPlanCapabilities} from '@/lib/server/public-cms';
import {essentialCapabilities,paidCapabilities} from '@/lib/plan-catalog';
export const dynamic='force-dynamic';
export default async function Pricing(){
 const [brand,plans,access,catalog]=await Promise.all([getPlatformBrand(),getPublishedPlans(),getViewerAccess(),getPublishedPlanCapabilities()]);
 const groups=[...new Set(paidCapabilities.map(f=>f.group))];
 return <main id="site-main" className="marketing-site site-refresh"><PublicNav name={brand.name} logo={brand.logo_url} access={access}/>
  <section className="marketing-section marketing-section-muted"><div className="marketing-container marketing-section-heading"><span className="marketing-kicker">PLANS & ACCESS</span><h1 className="public-page-title">The right tools for every stage of business.</h1><p>Choose from our available plans. Every plan includes the essential workspace, while additional modules depend on the subscription and your authorised business role.</p></div></section>
  <section className="marketing-section"><div className="marketing-container"><div className="public-pricing-grid plan-pricing-grid">{plans.length===0?<div className="marketing-feature"><h2>Plans are being prepared</h2><p>Our team is updating available options. Contact us to find the right fit.</p><Link href="/contact">Contact us →</Link></div>:plans.map(plan=>{
   const enabled=new Set(catalog.byPlan[plan.id]||[]);
   const active=paidCapabilities.filter(f=>enabled.has(f.key));
   return <article className="public-plan public-plan-detailed" key={plan.id}>
    <span className="marketing-kicker">{plan.billing_label||'SUBSCRIPTION'}</span><h2>{plan.name}</h2><p>{plan.description}</p><div className="public-plan-price">{plan.price_label||'Contact sales'}</div>
    <Link className="marketing-btn-primary" href={plan.cta_url.startsWith('/')?plan.cta_url:'/contact'}>{plan.cta_label||'Contact us'} <ArrowRight size={16}/></Link>
    <div className="plan-details-divider"/><h3>Everyday business essentials</h3><ul className="plan-capability-list">{essentialCapabilities.map(feature=><li key={feature.key}><CheckCircle2 size={17} aria-hidden="true"/><span title={feature.detail}>{feature.name}</span></li>)}</ul>
    <h3>Additional modules</h3>
    {!catalog.available?<p className="small muted" role="status">Current additional module access is being updated. Confirm availability with our team.</p>:active.length===0?<p className="small muted">No additional modules are enabled on this plan.</p>:groups.map(group=>{
     const entries=active.filter(f=>f.group===group);return entries.length?<div className="plan-feature-group" key={group}><strong>{group}</strong><ul className="plan-capability-list">{entries.map(f=><li key={f.key}><CheckCircle2 size={17} aria-hidden="true"/><span title={f.detail}>{f.name}</span></li>)}</ul></div>:null;})}
    {!!plan.features.length&&<details className="plan-marketing-notes"><summary>Other plan details</summary><ul>{plan.features.map((f,i)=><li key={i}>{f}</li>)}</ul></details>}
   </article>})}</div>
   {plans.length>0&&<section className="plan-comparison" aria-label="Detailed module comparison"><div className="marketing-section-heading"><span className="marketing-kicker">DETAILED COMPARISON</span><h2>Compare the complete workspace.</h2><p>Core capabilities are available in every plan. Additional modules are controlled by the platform administrator.</p></div>
    <div className="plan-comparison-scroll"><table><thead><tr><th scope="col">Capabilities</th>{plans.map(p=><th scope="col" key={p.id}>{p.name}</th>)}</tr></thead><tbody>
     <tr><th colSpan={plans.length+1} scope="rowgroup">Core workspace</th></tr>
     {essentialCapabilities.map(feature=><tr key={feature.key}><th scope="row" title={feature.detail}>{feature.name}</th>{plans.map(p=><td key={p.id}><span className="plan-included">Included</span></td>)}</tr>)}
     <tr><th colSpan={plans.length+1} scope="rowgroup">Additional modules</th></tr>
     {paidCapabilities.map(feature=><tr key={feature.key}><th scope="row" title={feature.detail}>{feature.name}</th>{plans.map(p=><td key={p.id}>{!catalog.available?<span className="muted">Check</span>:(catalog.byPlan[p.id]||[]).includes(feature.key)?<span className="plan-included">Included</span>:<span className="muted" aria-label="Not included"><LockKeyhole size={16}/></span>}</td>)}</tr>)}
    </tbody></table></div>
    <p className="small muted">Feature availability follows the approved business plan. Staff roles may further restrict access. Some modules are in active development; descriptions reflect current capabilities rather than promised integrations.</p>
   </section>}
  </div></section>
  <section className="marketing-final"><div className="marketing-container"><h2>Need a plan built around your operations?</h2><p>Our team can discuss the modules and staff permissions your business needs.</p><Link className="marketing-btn-primary" href="/contact">Speak with us <ArrowRight size={18}/></Link></div></section>
  <PublicFooter name={brand.name} tagline={brand.tagline} email={brand.support_email}/>
 </main>;
}
