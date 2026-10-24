import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export const dynamic='force-dynamic';
export default async function PlanAudit(){
 const admin=await requirePlatformAdmin();
 if(!admin)return <main className="admin-area"><h1>Administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const [plans,features,parents]=await Promise.all([
  admin.client.from('public_site_plans').select('id,name,published').order('sort_order').limit(100),
  admin.client.from('platform_plan_features').select('plan_id,feature_key,enabled').eq('enabled',true).limit(500),
  admin.client.from('plan_parent_links').select('plan_id,parent_plan_id').limit(100)
 ]);
 if(plans.error||features.error||parents.error)return <main className="admin-area"><h1>Plan audit unavailable</h1><p>Access to the plan configuration could not be verified.</p><Link href="/admin/health">System diagnostics</Link></main>;
 const parentOf=new Map((parents.data||[]).map(p=>[p.plan_id,p.parent_plan_id]));
 const reviews=(plans.data||[]).map(plan=>{
  const chain:string[]=[];const seen=new Set<string>([plan.id]);const warnings:string[]=[];
  let id=plan.id;
  for(let i=0;i<32;i++){const next=parentOf.get(id);if(!next)break;if(seen.has(next)){warnings.push('Inheritance cycle detected');break}if(!(plans.data||[]).some(p=>p.id===next)){warnings.push('Parent plan does not exist');break}chain.push(next);seen.add(next);id=next}
  const direct=(features.data||[]).filter(x=>x.plan_id===plan.id).map(x=>x.feature_key);
  const inherited=(features.data||[]).filter(x=>chain.includes(x.plan_id)&&!direct.includes(x.feature_key)).map(x=>x.feature_key);
  if(plan.id==='free'&&(direct.length||chain.length))warnings.push('Free plan premium access requires review');
  return {plan,direct:[...new Set(direct)],inherited:[...new Set(inherited)],warnings};
 });
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / AUDIT</span><h1>Plan configuration review</h1><p>Read-only diagnostic, not an access decision. Actual permissions are enforced by the database and role checks.</p></div><Link className="btn" href="/admin/plan-access">Edit plan access</Link></header>
  {reviews.map(({plan,direct,inherited,warnings})=><section key={plan.id} className="card card-pad" style={{margin:'14px 0'}}><h2>{plan.name}</h2><p>Direct modules: {direct.length?direct.join(', '):'None'}</p><p>Inherited modules: {inherited.length?inherited.join(', '):'None'}</p>{warnings.map(w=><p key={w} role="alert">{w}</p>)}</section>)}
 </main>;
}
