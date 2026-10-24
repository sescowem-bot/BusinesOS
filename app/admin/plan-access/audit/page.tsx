import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {essentialCapabilities,paidCapabilities,planRoles} from '@/lib/plan-catalog';
export const dynamic='force-dynamic';
type Plan={id:string;name:string;published:boolean};
type Feature={plan_id:string;feature_key:string;enabled:boolean};
type RoleGrant={plan_id:string;feature_key:string;role:string;enabled:boolean};
export default async function PlanAudit(){
 const admin=await requirePlatformAdmin();
 if(!admin)return <main className="admin-area"><h1>Administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const [plans,features,parents,staff]=await Promise.all([
  admin.client.from('public_site_plans').select('id,name,published').order('sort_order').limit(100),
  admin.client.from('platform_plan_features').select('plan_id,feature_key,enabled').limit(500),
  admin.client.from('plan_parent_links').select('plan_id,parent_plan_id').limit(100),
  admin.client.from('platform_plan_role_features').select('plan_id,feature_key,role,enabled').limit(1200)
 ]);
 if(plans.error||features.error||parents.error||staff.error)
  return <main className="admin-area"><h1>Plan audit unavailable</h1><p>Plan configuration and role permissions could not be verified. No changes were made.</p><Link href="/admin/health">Open system diagnostics</Link></main>;
 const availablePlans=(plans.data||[]) as Plan[];
 const featureRows=(features.data||[]) as Feature[];
 const staffRows=(staff.data||[]) as RoleGrant[];
 const parentOf=new Map((parents.data||[]).map(p=>[p.plan_id,p.parent_plan_id]));
 const plansReview=availablePlans.map(plan=>{
  const chain:string[]=[];const seen=new Set<string>([plan.id]);const warnings:string[]=[];
  let id=plan.id;
  for(let i=0;i<32;i++){
   const next=parentOf.get(id);if(!next)break;
   if(seen.has(next)){warnings.push('Inheritance contains a cycle.');break}
   if(!availablePlans.some(p=>p.id===next)){warnings.push('The parent plan is missing.');break}
   chain.push(next);seen.add(next);id=next;
  }
  const own=featureRows.filter(f=>f.plan_id===plan.id&&f.enabled).map(f=>f.feature_key);
  const inherited=featureRows.filter(f=>chain.includes(f.plan_id)&&f.enabled&&!own.includes(f.feature_key)).map(f=>f.feature_key);
  if(plan.id==='free'&&(own.length||chain.length))warnings.push('The Free plan has premium grants or inheritance that need review.');
  return {plan,chain,own:[...new Set(own)],inherited:[...new Set(inherited)],warnings};
 });
 const nice=(key:string)=>paidCapabilities.find(x=>x.key===key)?.name||key;
 return <main className="admin-area bo-plan-audit"><header className="admin-header">
  <div><span className="badge badge-brand">SYSTEM OWNER / PERMISSIONS</span><h1>Plans, modules and staff permissions</h1><p>Review what each subscription includes and the configured staff roles. These are different controls.</p></div>
  <div className="bo-plan-audit-actions"><Link className="btn btn-primary" href="/admin/plan-access">Edit plan access</Link><Link className="btn" href="/admin/usage-limits">Review usage limits</Link><Link className="btn" href="/admin/plan-actions">Action permissions</Link></div>
 </header>
 <section className="card card-pad bo-plan-audit-intro"><h2>How access works</h2>
  <div className="bo-plan-audit-steps"><p><strong>1. Subscription</strong> decides which additional modules the business can use.</p><p><strong>2. Staff role</strong> decides who can use a module within the business.</p><p><strong>3. Business-specific settings</strong> may further restrict staff or grant an audited exception.</p></div>
  <p className="small muted">Core tools are included with Free and every paid plan. This report shows plan-level role settings, not a complete list of create, edit, delete and approval permissions. Those still require database-enforced action-level controls.</p>
 </section>
 <div className="bo-plan-audit-grid">{plansReview.map(({plan,chain,own,inherited,warnings})=>{
  const enabled=[...new Set([...own,...inherited])].filter(x=>paidCapabilities.some(f=>f.key===x));
  const canUse=(key:string,role:string)=>{
   if(role==='owner')return true;
   const sources=[plan.id,...chain].filter(p=>featureRows.some(f=>f.plan_id===p&&f.feature_key===key&&f.enabled));
   return sources.some(source=>staffRows.some(r=>r.plan_id===source&&r.feature_key===key&&r.role===role&&r.enabled));
  };
  return <section className="card card-pad bo-plan-audit-card" key={plan.id}>
   <div className="bo-plan-audit-cardhead"><div><span className="small muted">{plan.published?'Published subscription':'Draft subscription'}</span><h2>{plan.name}</h2></div><Link href="/admin/plan-access" className="btn">Edit access</Link></div>
   <h3>Business essentials <span className="bo-plan-audit-count">{essentialCapabilities.length} included</span></h3>
   <ul className="bo-plan-audit-core">{essentialCapabilities.map(f=><li key={f.key}>{f.name}</li>)}</ul>
   <h3>Additional plan modules <span className="bo-plan-audit-count">{enabled.length} enabled</span></h3>
   {enabled.length?<ul className="bo-plan-audit-premium">{enabled.map(key=><li key={key}>{nice(key)}{inherited.includes(key)&&<small>Inherited</small>}</li>)}</ul>:
    <p className="small muted">{plan.id==='free'?'Free includes the business essentials above. Premium modules require a paid subscription or audited business exception.':'No additional premium modules enabled yet.'}</p>}
   {!!enabled.length&&<details className="bo-plan-audit-roles"><summary>Staff access by role</summary>
     <p className="small muted">Plan-level grants only. Business-specific staff restrictions still apply.</p>
     <div className="table-wrap"><table className="table"><thead><tr><th>Module</th>{planRoles.map(r=><th scope="col" key={r.key}>{r.name}</th>)}</tr></thead><tbody>{enabled.map(key=><tr key={key}><th scope="row">{nice(key)}</th>{planRoles.map(role=><td key={role.key}>{canUse(key,role.key)?'Yes':'—'}</td>)}</tr>)}</tbody></table></div>
    </details>}
   {warnings.map(w=><p className="bo-plan-audit-warning" role="alert" key={w}>{w}</p>)}
  </section>;
 })}</div>
 </main>;
}
