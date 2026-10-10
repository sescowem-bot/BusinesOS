import Link from 'next/link';
import {AdminNav} from '@/components/admin-nav';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {PlanEditor} from '../cms-form';
import {paidCapabilities,essentialCapabilities} from '@/lib/plan-catalog';
import type {PublicPlan} from '@/lib/server/public-cms';
export const dynamic='force-dynamic';
const newPlan:PublicPlan={id:'new-plan',name:'New business plan',price_label:'Contact sales',billing_label:'Custom quote',description:'',features:[],cta_label:'Request access',cta_url:'/contact',sort_order:50,published:false};
export default async function PlansAdmin(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><h1>Platform administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const [plansResult,featuresResult]=await Promise.all([
  session.client.from('public_site_plans').select('*').order('sort_order'),
  session.client.from('platform_plan_features').select('plan_id,feature_key,enabled')
 ]);
 const plans=(plansResult.data||[]) as PublicPlan[];
 const enabled=(featuresResult.data||[]).filter(f=>f.enabled===true);
 return <main className="admin-area plan-admin-area"><AdminNav active="website"/>
  <header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / PLANS</span><h1>Subscription plans and pricing</h1><p>Create as many plans as your business requires, publish them individually, and define actual module and staff-role access.</p></div><div className="plan-heading-actions"><Link className="btn" href="/pricing">View pricing ↗</Link><Link className="btn btn-primary" href="/admin/plan-access">Set access & roles →</Link></div></header>
  {(plansResult.error||featuresResult.error)&&<section className="card card-pad" role="alert"><h2>Plan configuration unavailable</h2><p>{plansResult.error?.message||featuresResult.error?.message}. Check migrations 016, 019 and 023.</p></section>}
  {!plansResult.error&&<><section className="grid grid-3" aria-label="Plan summary"><div className="card card-pad"><p className="small muted">Total plans</p><h2>{plans.length}</h2></div><div className="card card-pad"><p className="small muted">Published plans</p><h2>{plans.filter(x=>x.published).length}</h2></div><div className="card card-pad"><p className="small muted">Available module types</p><h2>{paidCapabilities.length} + {essentialCapabilities.length} core</h2></div></section>
  <section className="card card-pad plan-panel-intro" style={{marginTop:18}}><h2>No fixed two-plan limit</h2><p>Starter, Growth, Professional, Enterprise or completely custom packages are all possible. Publishing a plan makes it visible for new upgrade requests; editing an existing plan's permissions affects businesses already assigned to it.</p><p className="small muted">Plan prices and marketing highlights are not access permissions. Use <Link href="/admin/plan-access">Access & Roles</Link> to control what a business actually receives.</p></section>
  <div className="plan-card-directory">{plans.map(plan=><details className="card card-pad cms-panel plan-management-card" key={plan.id}><summary><strong>{plan.name}</strong><span className="small muted">{plan.price_label||'Contact sales'} · {plan.published?'Published':'Draft'} · {enabled.filter(f=>f.plan_id===plan.id).length}/{paidCapabilities.length} modules enabled</span></summary><div className="plan-card-links"><Link href="/admin/plan-access">Edit module and staff permissions →</Link><Link href="/admin/upgrades">Review upgrade requests →</Link></div><PlanEditor plan={plan}/></details>)}</div>
  <section className="card card-pad"><h2>Create another subscription plan</h2><p className="muted small">Give each plan a unique identifier. New plans start unpublished and with premium modules disabled until you configure them.</p><PlanEditor plan={newPlan}/></section>
  </>}
 </main>;
}
