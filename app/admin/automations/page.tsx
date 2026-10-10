import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {AutomationReviewForm} from './review-form';
export const dynamic='force-dynamic';
export default async function PlatformAutomations(){
 const session=await requirePlatformAdmin();if(!session)return <main><h1>Administrator access required</h1><Link href="/login">Login</Link></main>;
 const [requests,directory]=await Promise.all([
  session.client.from('business_automation_requests').select('id,business_id,title,details,category,delivery_channel,status,quote_note,admin_note,created_at').order('created_at',{ascending:false}).limit(100),
  session.client.rpc('platform_business_directory')
 ]);
 const names=new Map(((directory.data||[]) as {business_id:string;business_name:string}[]).map(b=>[b.business_id,b.business_name]));
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / AUTOMATION</span><h1>Automation service requests</h1><p>Review requested tasks, send quotations, record approvals and track setup. No scheduled sending is enabled by reviewing a request.</p></div><Link className="btn" href="/admin/businesses">Businesses →</Link></header>
 {(requests.error||directory.error)&&<section className="card card-pad" role="alert">Cannot load all automation requests. Confirm SQL migration 029 and administrator permissions.</section>}
 <section className="grid grid-2">{!requests.error&&(requests.data||[]).map(r=><article className="card card-pad" key={r.id}><p className="small muted">{names.get(r.business_id)||r.business_id} · {r.category.replaceAll('_',' ')} · {new Date(r.created_at).toLocaleDateString('en-NG')}</p><h2>{r.title}</h2><p>{r.details}</p><p className="small muted">Delivery: {r.delivery_channel} · Status: <strong>{r.status}</strong></p>{r.quote_note&&<p><strong>Quotation:</strong> {r.quote_note}</p>}{r.admin_note&&<p className="small muted"><strong>Admin note:</strong> {r.admin_note}</p>}{['requested','quoted','accepted'].includes(r.status)&&<AutomationReviewForm requestId={r.id} status={r.status}/>}</article>)}{!requests.error&&!requests.data?.length&&<section className="card card-pad"><p>No automation requests yet.</p></section>}</section>
 </main>;
}
