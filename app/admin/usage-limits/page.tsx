import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {LimitEditor,TrialEditor} from './editor';
import {TrialModuleSettings,IssueModuleTrial} from './trial-editor';
export const dynamic='force-dynamic';
const metrics=[['customers','Customers'],['products','Products & services'],['team_members','Team members'],['branches','Branches'],['orders_monthly','Monthly orders']] as const;
export default async function UsageLimits(){
 const admin=await requirePlatformAdmin();if(!admin)return <main className="admin-area"><h1>System Owner access required</h1><Link href="/login">Sign in</Link></main>;
 const [plans,caps,flag,trials,modules]=await Promise.all([
  admin.client.from('public_site_plans').select('id,name,published').order('sort_order'),
  admin.client.from('platform_plan_usage_limits').select('plan_id,metric_key,max_count').limit(500),
  admin.client.from('platform_usage_enforcement').select('enabled').eq('id',true).maybeSingle(),
  admin.client.from('platform_plan_trial_settings').select('plan_id,trial_days,enabled').limit(100),
  admin.client.from('platform_plan_trial_modules').select('plan_id,feature_key,enabled').limit(250)
 ]);
 const ready=!plans.error&&!caps.error&&!flag.error&&!trials.error&&!modules.error;
 const enforcement=ready&&flag.data?.enabled===true;
 return <main className="admin-area">
  <header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / SUBSCRIPTIONS</span><h1>Usage limits &amp; trials</h1>
   <p>Manage the capacity of each subscription plan and configure preferred trial offers.</p></div>
   <Link className="btn" href="/admin/plan-actions">Role permissions</Link></header>
  {!ready?<section className="card card-pad" role="status" style={{margin:'16px 0'}}><h2>Usage settings are being configured</h2><p>Your existing subscriptions are unchanged. Please try again shortly.</p></section>:
   <>
    <section className="card card-pad" role="status" style={{margin:'16px 0'}}><h2>{enforcement?'Numerical limits active':'Configuration mode'}</h2>
      <p>{enforcement?'Configured numerical limits are being enforced.':'You can edit and audit settings below. Numerical enforcement is not yet active, so saving a limit will not block existing customer activity.'}</p></section>
    {(plans.data||[]).map(plan=>{const trial=(trials.data||[]).find(t=>t.plan_id===plan.id);return <section className="card card-pad" key={plan.id} style={{marginBottom:18}}>
       <h2>{plan.name}</h2><div className="table-wrap"><table className="table"><thead><tr><th>Business activity</th><th>Current</th><th>Set limit</th></tr></thead>
       <tbody>{metrics.map(([key,label])=>{const row=(caps.data||[]).find(x=>x.plan_id===plan.id&&x.metric_key===key);return <tr key={key}><th>{label}</th><td>{row?Number(row.max_count).toLocaleString('en-NG'):'Not set'}</td><td><LimitEditor plan={plan.id} metric={key} value={row?Number(row.max_count):null}/></td></tr>})}</tbody></table></div>
       <h3 style={{marginTop:22}}>Trial preferences</h3><p className="small muted">You can save a preferred trial length; trials do not start automatically until the access-expiry and billing lifecycle is implemented.</p>
       <TrialEditor plan={plan.id} days={trial?.trial_days??0} enabled={trial?.enabled??false}/>
       <TrialModuleSettings plan={plan.id} enabledKeys={(modules.data||[]).filter(m=>m.plan_id===plan.id&&m.enabled).map(m=>m.feature_key)}/>
    </section>})}
   <IssueModuleTrial options={(modules.data||[]).filter(m=>m.enabled&&(trials.data||[]).some(t=>t.plan_id===m.plan_id&&t.enabled&&t.trial_days>0)).map(m=>({plan:m.plan_id,feature:m.feature_key,label:m.plan_id+' / '+m.feature_key}))}/>
   </>}
 </main>;
}
