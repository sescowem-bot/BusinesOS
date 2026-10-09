import {getServerSupabase} from '@/lib/server/supabase';
import {requestUpgrade} from './actions';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function UpgradePage(){
 const client=await getServerSupabase();if(!client)redirect('/login');
 const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:members}=await client.from('business_members').select('business_id,role,businesses(name)').eq('user_id',user.id).limit(1);
 const member=members?.[0];if(!member)redirect('/onboarding');
 const [plans,requests,assignments]=await Promise.all([
 client.from('public_site_plans').select('id,name,description,price_label,billing_label,features').eq('published',true).order('sort_order'),
 client.from('business_upgrade_requests').select('id,plan_id,status,requested_at,review_note').eq('business_id',member.business_id).order('requested_at',{ascending:false}).limit(10),
 client.from('business_plan_assignments').select('plan_id,approved_at').eq('business_id',member.business_id).maybeSingle()
 ]);
 return <div className="tax-page"><p className="small muted">BUSINESS / SUBSCRIPTION</p><h1>Plans & upgrades</h1><p className="muted">Choose a plan and request access. Only the platform administration team can approve changes. No online charge is made here.</p>
 <div className="tax-panel"><h2>Current plan</h2><p>{assignments.data?.plan_id||'No approved plan assigned yet'}</p>{requests.error&&<p role="alert">Unable to read request history. Check database migration 017.</p>}<h3>Request history</h3>{requests.data?.length?requests.data.map(r=><p key={r.id}><strong>{r.plan_id}</strong> — {r.status} <span className="muted small">{new Date(r.requested_at).toLocaleDateString('en-NG')}</span>{r.review_note&&<span> — {r.review_note}</span>}</p>):<p className="muted">No previous requests.</p>}</div>
 <div className="grid grid-3">{plans.data?.map(plan=><section className="tax-panel" key={plan.id}><h2>{plan.name}</h2><p>{plan.price_label} {plan.billing_label}</p><p>{plan.description}</p><ul>{(plan.features||[]).map((item:string,i:number)=><li key={i}>{item}</li>)}</ul>{member.role==='owner'?<form action={requestUpgrade}><input type="hidden" name="business_id" value={member.business_id}/><input type="hidden" name="plan_id" value={plan.id}/><label className="field">Reason for upgrade (optional)<textarea name="reason" rows={2} maxLength={1200}/></label><button className="btn btn-primary" disabled={!!requests.data?.some(r=>r.status==='pending')||assignments.data?.plan_id===plan.id}>Request upgrade</button></form>:<p className="muted small">Only the business owner can request a change.</p>}</section>)}{!plans.data?.length&&<p>No published plans. Contact platform support.</p>}</div></div>;
}
