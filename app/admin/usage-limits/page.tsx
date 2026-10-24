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
 const planLoaded=!plans.error;
 const limitsLoaded=!caps.error&&!flag.error;
 const active=limitsLoaded&&flag.data?.enabled===true;
 return <main className="admin-area">
  <header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / SUBSCRIPTIONS</span><h1>Usage limits</h1>
   <p>Review how many customers, products, staff, branches and monthly orders your subscription plans allow.</p></div>
   <Link href="/admin/plan-access" className="btn">Manage module access</Link>
  </header>
  <section className="card card-pad" role="status" style={{margin:'18px 0'}}>
   <h2>{!planLoaded?'Plan information temporarily unavailable':!limitsLoaded?'Numerical plan limits are not yet configured':active?'Usage limits are active':'Usage limits are currently switched off'}</h2>
   <p>{!planLoaded?'Please try again shortly. Subscription access has not been changed.':
   !limitsLoaded?'You can continue managing plans and their included modules. Limits on record counts are being introduced separately; no customer access is changed by this screen.':
   active?'The configured numerical limits are being enforced by the system. Module permissions remain separately controlled.':
   'Plan limits are visible below, but numerical enforcement is not yet active. Existing business records and access remain unchanged.'}</p>
  </section>
  {planLoaded&&(plans.data||[]).map(plan=><section key={plan.id} className="card card-pad" style={{marginBottom:14}}>
   <h2>{plan.name} <small className="muted">{plan.published?'Published':'Draft'}</small></h2>
   <div className="table-wrap"><table className="table"><thead><tr><th>Business activity</th><th>{limitsLoaded?'Configured limit':'Status'}</th></tr></thead>
   <tbody>{Object.entries(labels).map(([key,label])=>{
    const cap=limitsLoaded?(caps.data||[]).find(x=>x.plan_id===plan.id&&x.metric_key===key):null;
    return <tr key={key}><td>{label}</td><td>{!limitsLoaded?'Not configured':cap?Number(cap.max_count).toLocaleString('en-NG'):'No direct limit set'}</td></tr>;
   })}</tbody></table></div>
  </section>)}
  <p className="small muted">System Owner plan-module controls remain available through Manage module access. Numerical limit editing will be available after its enforcement configuration is completed.</p>
 </main>;
}
