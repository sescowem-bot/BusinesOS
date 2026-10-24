import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export const dynamic='force-dynamic';
const labels:Record<string,string>={customers:'Customers',products:'Products & services',team_members:'Team members',branches:'Branches',orders_monthly:'Monthly orders'};
export default async function UsageLimits(){
 const admin=await requirePlatformAdmin();
 if(!admin)return <main className="admin-area"><h1>System Owner access required</h1><Link href="/login">Sign in</Link></main>;
 const [plans,caps,flag]=await Promise.all([
  admin.client.from('public_site_plans').select('id,name,published').order('sort_order').limit(100),
  admin.client.from('platform_plan_usage_limits').select('plan_id,metric_key,max_count').limit(500),
  admin.client.from('platform_usage_enforcement').select('enabled').eq('id',true).maybeSingle()
 ]);
 const ready=!plans.error&&!caps.error&&!flag.error;
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / SUBSCRIPTIONS</span><h1>Usage limits</h1><p>Read-only configuration overview. Database enforcement requires a separately reviewed, tested migration.</p></div><Link className="btn" href="/admin/plan-access">Manage module access</Link></header>
  <section className="card card-pad" role="status" style={{margin:'18px 0'}}>
   <h2>{ready?(flag.data?.enabled===true?'Database enforcement reports enabled':'Database enforcement disabled'):'Usage limits not installed or inaccessible'}</h2>
   <p>{ready?'This overview reflects database configuration only. UI settings cannot override transaction guards.':'Do not apply the staging-only Phase 3D SQL in production. Run it in disposable staging and test all writers first.'}</p>
  </section>
  {ready&&(plans.data||[]).map(plan=><section key={plan.id} className="card card-pad" style={{marginBottom:14}}><h2>{plan.name} <small>{plan.published?'Published':'Draft'}</small></h2>
   <div className="table-wrap"><table className="table"><thead><tr><th>Metric</th><th>Direct cap</th></tr></thead><tbody>{Object.entries(labels).map(([key,label])=>{const cap=(caps.data||[]).find(x=>x.plan_id===plan.id&&x.metric_key===key);return <tr key={key}><td>{label}</td><td>{cap?cap.max_count:'Not set directly — review inheritance'}</td></tr>})}</tbody></table></div>
  </section>)}
  <p className="small muted">The System Owner can configure and audit limits after the database functions have passed staging and their editing permissions are verified. This page intentionally contains no unsafe direct database writes.</p>
 </main>;
}
