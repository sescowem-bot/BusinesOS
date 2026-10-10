import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {ReviewUpgradeForm} from './review-form';
export const dynamic='force-dynamic';
type Directory={business_id:string;business_name:string};
export default async function AdminUpgrades(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-area"><h1>Administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const [directory,requests,plans]=await Promise.all([
  session.client.rpc('platform_business_directory'),
  session.client.from('business_upgrade_requests').select('id,business_id,plan_id,status,justification,requested_at,review_note').order('requested_at',{ascending:false}).limit(100),
  session.client.from('public_site_plans').select('id,name')
 ]);
 const names=new Map(((directory.data||[]) as Directory[]).map(b=>[b.business_id,b.business_name]));
 const planNames=new Map((plans.data||[]).map(p=>[p.id,p.name]));
 return <main className="admin-area"><Link href="/admin">← Administration</Link><h1>Business plan requests</h1><p className="muted">Every plan change requires a platform administrator decision. Approval records the reviewer and activation time.</p>
 {(directory.error||requests.error||plans.error)&&<section className="card card-pad" role="alert"><strong>One or more administration services are unavailable.</strong><p>Please check database readiness under <Link href="/admin/health">System diagnostics</Link>. Review controls are disabled until request records are available.</p></section>}
 <div className="grid grid-2">{!requests.error&&(requests.data||[]).map(r=><section className="card card-pad" key={r.id}><p className="badge">{r.status}</p><h2>{planNames.get(r.plan_id)||r.plan_id}</h2><p className="small muted">Business: {names.get(r.business_id)||r.business_id}</p><p className="small muted">Requested: {new Date(r.requested_at).toLocaleString('en-NG')}</p><p>{r.justification||'No reason provided'}</p>{r.status==='pending'?<ReviewUpgradeForm requestId={r.id}/>:<p className="muted small">Decision: {r.review_note||'No note'}</p>}</section>)}
 {!requests.error&&!requests.data?.length&&<p>No upgrade requests recorded.</p>}</div></main>;
}
