import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {CreateMyBusinessForm} from './create-form';
import {openMyBusiness} from './actions';

export const dynamic='force-dynamic';
type PageProps={searchParams:Promise<{error?:string}>};
export default async function MyBusinessPage({searchParams}:PageProps){
 const session=await requirePlatformAdmin();
 if(!session)redirect('/login');
 const {data:memberships,error:membershipError}=await session.client.from('business_members')
  .select('business_id,role').eq('user_id',session.user.id).order('created_at',{ascending:true});
 const ids=[...new Set((memberships||[]).map(item=>item.business_id))];
 const businessResult=ids.length?await session.client.from('businesses')
  .select('id,name,category').in('id',ids):{data:[],error:null};
 const businessMap=new Map((businessResult.data||[]).map(b=>[b.id,b]));
 const error=(await searchParams).error;
 return <main className="admin-area"><div className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / MY BUSINESS</span><h1>My Business Workspace</h1><p>Run your own business with the same dashboard, customers, orders, products, payments and reports available to BusinessOS customers.</p></div><Link href="/admin" className="btn">Back to System Owner</Link></div>
 
 <div className="owner-workspace-intro"><section className="card card-pad"><span className="badge badge-brand">YOUR OPERATIONS</span><h2>My Business</h2><p className="muted small">Open a business that you personally own or belong to. Its transactions stay separate from other BusinessOS customers.</p></section><section className="card card-pad"><span className="badge badge-brand">PLATFORM ADMINISTRATION</span><h2>Manage the Platform</h2><p className="muted small">Review all registered businesses, website content, approvals and platform settings.</p><Link className="btn" href="/admin">Go to Platform Management</Link></section></div>
 {error==='selection'&&<p className="negative" role="alert">You can only open a business workspace associated with your own account.</p>}
 {(membershipError||businessResult.error)&&<p className="negative" role="alert">Your memberships could not be loaded. Please try again. No other customer data has been opened.</p>}
 {!membershipError&&!businessResult.error&&<section className="card card-pad" style={{marginTop:18}}><div className="owner-section-header"><div><h2>Your business workspaces</h2><p className="muted small">Select a business to open its operational dashboard. Your existing role and plan restrictions continue to apply.</p></div><span className="badge badge-brand">{memberships?.length||0} available</span></div>
  {ids.length?<div className="owner-business-list">{(memberships||[]).map(m=>{const b=businessMap.get(m.business_id);return <div className="owner-business-row" key={m.business_id}><div><strong>{b?.name||'Business details unavailable'}</strong><p className="small muted">{b?.category||'Business'} · {m.role==='owner'?'Business Owner':m.role}</p></div><form action={openMyBusiness}><input type="hidden" name="business_id" value={m.business_id}/><button type="submit" className="btn btn-primary">Open dashboard →</button></form></div>})}</div>:<div className="empty">You haven't created or joined a business workspace yet. Create your own below.</div>}
 </section>}
 <section className="card card-pad owner-create-workspace"><h2>Create a business for yourself</h2><p className="muted small">You'll be the business owner. This is a normal, isolated customer workspace linked to your account, not a way to access or impersonate another business.</p><CreateMyBusinessForm/></section>
 <p className="muted small" style={{marginTop:16}}>Platform Admin status does not automatically unlock paid modules or bypass business permissions. Plan access is controlled separately in the Platform Management area.</p>
 </main>;
}
