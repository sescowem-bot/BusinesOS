import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {AdminNav} from '@/components/admin-nav';
import {paidCapabilities,type PaidFeature,type PlanRole} from '@/lib/plan-catalog';
import {PlanPermissionEditor} from './permission-editor';
export const dynamic='force-dynamic';
export default async function PlanAccessPage(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><h1>Administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const [plansResult,accessResult,rolesResult]=await Promise.all([
  session.client.from('public_site_plans').select('id,name,published,description,price_label').order('sort_order'),
  session.client.from('platform_plan_features').select('plan_id,feature_key,enabled'),
  session.client.from('platform_plan_role_features').select('plan_id,feature_key,role,enabled')
 ]);
 return <main className="admin-area plan-admin-area"><AdminNav active="website"/><header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / SUBSCRIPTIONS</span><h1>Plan access and staff roles</h1><p>Give each plan the modules it should unlock and control which business staff roles can use them.</p></div><Link href="/admin/plans" className="btn btn-primary">Manage pricing & create plan →</Link></header>
 {(plansResult.error||accessResult.error||rolesResult.error)&&<section className="card card-pad" role="alert"><h2>Plan permissions are unavailable</h2><p>{plansResult.error?.message||accessResult.error?.message||rolesResult.error?.message}</p><p>Confirm migration 023 is installed; existing configurations have not been modified.</p></section>}
 {!plansResult.error&&!accessResult.error&&!rolesResult.error&&<>{(plansResult.data||[]).map(plan=>{
  const features=Object.fromEntries((accessResult.data||[]).filter(x=>x.plan_id===plan.id).map(x=>[x.feature_key,x.enabled])) as Partial<Record<PaidFeature,boolean>>;
  const roles:Partial<Record<PaidFeature,Partial<Record<PlanRole,boolean>>>>={};
  for(const row of rolesResult.data||[]){if(row.plan_id!==plan.id)continue;const feature=row.feature_key as PaidFeature;roles[feature]={...roles[feature],[row.role]:row.enabled};}
  return <details key={plan.id} className="card card-pad cms-panel plan-access-panel"><summary><strong>{plan.name}</strong><span className="small muted">{plan.published?'Published':'Draft'} · {plan.price_label} · {paidCapabilities.filter(x=>features[x.key]===true).length} additional modules enabled</span></summary><div className="plan-access-intro"><p className="small muted">{plan.description}</p><p>All essential workspace features are included. Enable additional modules below, then choose authorised staff roles.</p></div><PlanPermissionEditor planId={plan.id} initialFeatures={features} initialRoles={roles}/></details>})}
  {!(plansResult.data||[]).length&&<section className="card card-pad"><p>No plans yet. <Link href="/admin/plans">Create a plan</Link> first.</p></section>}
 </>}
 </main>;
}
