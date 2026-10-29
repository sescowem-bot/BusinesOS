import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {paidCapabilities,type PaidFeature,type PlanRole} from '@/lib/plan-catalog';
import {PlanPermissionEditor} from './permission-editor';
import {CorePlanAccessEditor} from './core-editor';
import '../permissions-studio.css';

export const dynamic='force-dynamic';
type Query={plan?:string};
export default async function PlanAccessPage({searchParams}:{searchParams:Promise<Query>}){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><h1>Administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const [plansResult,accessResult,rolesResult,coresResult]=await Promise.all([
  session.client.from('public_site_plans').select('id,name,published,description,price_label').order('sort_order'),
  session.client.from('platform_plan_features').select('plan_id,feature_key,enabled'),
  session.client.from('platform_plan_role_features').select('plan_id,feature_key,role,enabled'),
  session.client.from('platform_plan_core_features').select('plan_id,feature_key,enabled')
 ]);
 if(plansResult.error||accessResult.error||rolesResult.error||coresResult.error)return <main className="admin-area bo-plan-studio"><h1>Plan access &amp; staff roles</h1><section className="card card-pad" role="alert"><h2>Permission settings are temporarily unavailable</h2><p>No changes have been made. Please retry later or review the System Owner diagnostics.</p><Link href="/admin/health" className="btn">System health</Link></section></main>;
 const plans=plansResult.data||[];
 const query=await searchParams;
 const chosen=plans.find(p=>p.id===query.plan)||plans.find(p=>p.id==='free')||plans[0];
 const features:Partial<Record<PaidFeature,boolean>>=chosen?Object.fromEntries((accessResult.data||[]).filter(row=>row.plan_id===chosen.id).map(row=>[row.feature_key,row.enabled])) as Partial<Record<PaidFeature,boolean>>:{};
 const roles:Partial<Record<PaidFeature,Partial<Record<PlanRole,boolean>>>>={};
 for(const row of rolesResult.data||[]){if(row.plan_id!==chosen?.id)continue;const key=row.feature_key as PaidFeature;roles[key]={...roles[key],[row.role]:row.enabled};}
 const core=Object.fromEntries((coresResult.data||[]).filter(row=>row.plan_id===chosen?.id).map(row=>[row.feature_key,row.enabled]));
 return <main className="admin-area plan-admin-area bo-plan-studio">
  <header className="admin-header bo-plan-studio-header"><div><span className="badge badge-brand">SYSTEM OWNER / ACCESS CONTROL</span><h1>Plan access &amp; staff roles</h1><p>Choose a subscription, select its modules, then assign the staff roles that can use them.</p></div><div className="bo-plan-studio-links"><Link className="btn" href="/admin/plans">Manage pricing</Link><Link className="btn" href="/admin/plan-actions">Action permissions</Link><Link className="btn" href="/admin/usage-limits">Usage limits</Link></div></header>
  {plans.length>0?<>
   <nav className="bo-plan-switcher" aria-label="Choose a plan to configure">{plans.map(p=><Link key={p.id} href={'/admin/plan-access?plan='+encodeURIComponent(p.id)} aria-current={p.id===chosen?.id?'page':undefined} className={'bo-plan-switcher-tab'+(p.id===chosen?.id?' is-active':'')}><strong>{p.name}</strong><span>{p.published?'Published':'Unpublished'}</span></Link>)}</nav>
   {chosen&&<>
    <section className="bo-plan-studio-summary"><div><span className="small muted">SELECTED SUBSCRIPTION</span><h2>{chosen.name}</h2><p>{chosen.description||'Configure included tools and which staff can access them.'}</p><span className="small muted">{chosen.price_label} · {paidCapabilities.filter(x=>features[x.key]===true).length} directly enabled premium modules</span></div><Link className="btn" href="/admin/plan-access/audit">Review effective plan access</Link></section>
    {chosen.id==='free'&&<p className="bo-plan-studio-advice" role="note"><strong>Free-plan safety:</strong> You can configure its core tools below. Existing database protections prevent enabling paid modules directly on Free; approved individual company trials are managed separately. Unpublishing a plan does not automatically close existing subscriptions or disable Free onboarding.</p>}
    <section className="bo-plan-studio-section"><div className="bo-plan-studio-heading"><div><h2>Business essentials</h2><p>Control access to core tools. Keep essential owner administration available to prevent account lockouts.</p></div></div><CorePlanAccessEditor key={chosen.id+'-core'} plan={chosen.id} values={core}/></section>
    <section className="bo-plan-studio-section"><div className="bo-plan-studio-heading"><div><h2>Additional modules &amp; staff roles</h2><p>Enable a module for this subscription, then select which staff roles may use it. The business owner retains access to included modules.</p></div></div><PlanPermissionEditor key={chosen.id+'-premium'} planId={chosen.id} initialFeatures={features} initialRoles={roles}/></section>
    <p className="small muted bo-plan-studio-footer">Module selection alone does not configure individual View, Create, Edit, Delete, Approve or Export actions. Those controls are separate, and database enforcement must be verified before enabling them in production.</p>
   </>}
  </>:<section className="card card-pad"><p>No subscription plans have been created.</p><Link href="/admin/plans" className="btn btn-primary">Create a plan</Link></section>}
 </main>;
}
