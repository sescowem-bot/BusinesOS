import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {planRoles,essentialCapabilities,paidCapabilities} from '@/lib/plan-catalog';
import {validPlanId,validRole,type StoredDecision} from '@/lib/role-action-catalog';
import {ActionMatrixEditor} from './editor';
export const dynamic='force-dynamic';
export default async function PlanActions({searchParams}:{searchParams:Promise<{plan?:string;role?:string}>}){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-area"><h1>System Owner access required</h1><Link href="/login">Sign in</Link></main>;
 const {data:plans,error}=await session.client.from('public_site_plans').select('id,name,published').order('sort_order').limit(100);
 if(error||!plans)return <main className="admin-area"><h1>Permission data unavailable</h1><p>Plans could not be verified.</p></main>;
 const q=await searchParams;
 const p=validPlanId(q.plan)?plans.find(item=>item.id===q.plan):null;
 const plan=p||plans.find(item=>item.id==='free')||plans[0];
 const role=validRole(q.role)?q.role:'manager';
 if(!plan)return <main className="admin-area"><h1>No subscription plans exist</h1><Link href="/admin/plans">Manage plans</Link></main>;
 const saved=await session.client.from('platform_plan_action_overrides').select('module_key,action_key,role,decision').eq('plan_id',plan.id).eq('role',role).limit(150);
 const history=!saved.error?await session.client.from('platform_plan_action_audit').select('id,changed_at,reason').eq('plan_id',plan.id).eq('role',role).order('changed_at',{ascending:false}).limit(12):null;
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / ROLE PERMISSIONS</span><h1>Actions by plan and staff role</h1><p>Configure View, Create, Edit, Delete, Approve and Export for every module. Separate from whether a subscription includes that module.</p></div><div><Link href="/admin/plan-access" className="btn">Module access</Link> <Link href="/admin/plan-access/audit" className="btn">Plan audit</Link></div></header>
  <section className="card card-pad" style={{margin:'18px 0'}}><form method="get" action="/admin/plan-actions" className="bo-action-picker"><label>Subscription plan<select name="plan" defaultValue={plan.id}>{plans.map(item=><option value={item.id} key={item.id}>{item.name}{item.published?'':' (draft)'}</option>)}</select></label><label>Staff role<select name="role" defaultValue={role}>{planRoles.map(item=><option key={item.key} value={item.key}>{item.name}</option>)}</select></label><button type="submit" className="btn">Review role</button></form><p className="small muted">{essentialCapabilities.length} core tools and {paidCapabilities.length} optional premium modules. Current legacy role restrictions remain effective.</p></section>
  {saved.error?<section className="card card-pad" role="alert"><h2>Action-level controls are pending database setup</h2><p>No subscription or business permissions have changed. The staging-only SQL is included in the repository review folder. It must be verified before activation.</p><Link href="/admin/plan-access">Use existing module-level permissions</Link></section>:
   <><ActionMatrixEditor key={plan.id+role} planId={plan.id} planName={plan.name} role={role} rows={(saved.data||[]) as StoredDecision[]}/><section className="card card-pad" style={{marginTop:18}}><h2>Recent permission changes</h2><p className="small muted">System Owner changes to this subscription plan and staff role are recorded with a reason. These settings remain staged until database enforcement has been approved.</p>{history?.error?<p role="alert">Audit history is temporarily unavailable.</p>:history?.data?.length?<div className="table-wrap"><table className="table"><thead><tr><th>When</th><th>Reason</th></tr></thead><tbody>{history.data.map(row=><tr key={row.id}><td>{new Date(row.changed_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'})}</td><td>{row.reason}</td></tr>)}</tbody></table></div>:<p className="small muted">No audited permission changes yet.</p>}</section></>}
 </main>;
}
