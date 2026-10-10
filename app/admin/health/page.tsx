import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export const dynamic='force-dynamic';
const checks=[
 {label:'Platform branding',table:'platform_branding'},
 {label:'Website CMS',table:'public_site_pages'},
 {label:'Published plans',table:'public_site_plans'},
 {label:'Upgrade approvals',table:'business_upgrade_requests'},
 {label:'Plan assignments',table:'business_plan_assignments'},
 {label:'Feature entitlements',table:'platform_plan_features'},
 {label:'User notifications',table:'user_notifications'},
 {label:'Notification preferences',table:'notification_preferences'},
 {label:'Email templates',table:'platform_email_templates'}
] as const;
export default async function AdminHealth(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-area"><h1>Administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const results=await Promise.all(checks.map(async c=>{
  const {error}=await session.client.from(c.table).select('*',{head:true,count:'exact'}).limit(1);
  return {...c,ok:!error,code:error?.code||null};
 }));
 const {error:directoryError}=await session.client.rpc('platform_business_directory');
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">PLATFORM OWNER / DIAGNOSTICS</span><h1>Database readiness</h1><p>Read-only connectivity and administrator permission checks for migrations 016–020.</p></div><Link href="/admin" className="btn">Back to administration</Link></header>
 <section className="card card-pad"><h2>Migration-dependent services</h2><div className="table-wrap"><table className="table"><thead><tr><th>Service</th><th>Database object</th><th>Result</th></tr></thead><tbody>{results.map(r=><tr key={r.table}><td>{r.label}</td><td><code>{r.table}</code></td><td>{r.ok?<strong>Accessible</strong>:<span role="alert">Not accessible {r.code?`(${r.code})`:''}</span>}</td></tr>)}<tr><td>Super Admin business directory</td><td><code>platform_business_directory()</code></td><td>{directoryError?<span role="alert">Not accessible ({directoryError.code})</span>:<strong>Accessible</strong>}</td></tr></tbody></table></div><p className="muted small">An accessible table is not proof that every workflow is functional. These checks do not send mail, alter records, or test live Resend delivery.</p></section>
 </main>;
}
