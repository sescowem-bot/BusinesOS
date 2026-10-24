import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {BusinessReviewForm} from './review-form';
import {setVerifiedListing} from './listing-actions';
import {FeatureGrantForm} from './feature-grant-form';
import {paidCapabilities,essentialCapabilities} from '@/lib/plan-catalog';
import {moduleWorkflows} from '@/lib/feature-directory';
import {CompanyPriceForm,CompanyRoleForm,CompanyRoleAssignmentForm} from './company-access-forms';
import {ManualPlanForm} from './manual-plan-form';
export const dynamic='force-dynamic';
type Member={user_id:string;full_name:string|null;role:string;joined_at:string};
type Review={status:string;note:string;updated_at:string};
type History={status:string;changed_at:string};
type Detail={id:string;name:string;slug:string;category:string;email:string|null;phone:string|null;city:string|null;state:string|null;country:string;created_at:string;published:boolean;verified:boolean;plan_id:string|null;members:Member[];pending_upgrades:number;review:Review|null;review_history:History[]};
export default async function BusinessDetails({params}:{params:Promise<{id:string}>}){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><h1>Platform administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const {data,error}=await session.client.rpc('platform_business_detail',{p_business_id:id});
 if(error)return <main className="admin-area"><Link href="/admin/businesses">← Business directory</Link><section className="card card-pad" role="alert"><h1>Unable to load business</h1><p>Please try again. If the issue continues, contact support.</p><p className="muted">Make sure you are signed in with an authorised administrator account.</p></section></main>;
 if(!data)notFound();
 const b=data as Detail;
 const [grantsResult,auditResult,planFeaturesResult,parentResult,roleProfilesResult,roleAssignmentsResult,pricesResult,availablePlansResult,manualAuditResult]=await Promise.all([
  session.client.from('business_feature_grants').select('feature_key,enabled,allowed_roles,expires_at,note,updated_at').eq('business_id',id).order('feature_key'),
  session.client.from('business_feature_grant_audit').select('id,feature_key,changed_at,changed_by').eq('business_id',id).order('changed_at',{ascending:false}).limit(20),
  session.client.from('platform_plan_features').select('plan_id,feature_key,enabled').eq('enabled',true).limit(500),
  session.client.from('plan_parent_links').select('plan_id,parent_plan_id').limit(100),
  session.client.from('business_company_role_profiles').select('id,name,description,base_role,allowed_modules,active').eq('business_id',id).order('name').limit(75),
  session.client.from('business_company_role_assignments').select('user_id,profile_id').eq('business_id',id).limit(150),
  session.client.from('business_feature_prices').select('feature_key,price_monthly_ngn,price_yearly_ngn,note').eq('business_id',id).limit(50),
  session.client.from('public_site_plans').select('id,name').eq('published',true).order('sort_order').limit(80),
  session.client.from('business_admin_plan_audit').select('id,previous_plan_id,new_plan_id,reason,changed_at').eq('business_id',id).order('changed_at',{ascending:false}).limit(12)
 ]);
 const profiles=(roleProfilesResult.data||[]) as {id:string;name:string;description:string;base_role:string;allowed_modules:string[];active:boolean}[];
 const assignments=(roleAssignmentsResult.data||[]) as {user_id:string;profile_id:string}[];
 const prices=(pricesResult.data||[]) as {feature_key:string;price_monthly_ngn:number|null;price_yearly_ngn:number|null;note:string}[];
 const ancestry=new Set<string>();let next:string|undefined=b.plan_id||undefined;
 for(let i=0;next&&i<32&&!ancestry.has(next);i++){ancestry.add(next);next=parentResult.data?.find(x=>x.plan_id===next)?.parent_plan_id||undefined;}
 const fromPlan=new Set((planFeaturesResult.data||[]).filter(x=>ancestry.has(x.plan_id)&&x.enabled).map(x=>x.feature_key));
 const activeExtras=new Set((grantsResult.data||[]).filter(x=>x.enabled&&(!x.expires_at||new Date(x.expires_at)>new Date())).map(x=>x.feature_key));
 const grants=(grantsResult.data||[]) as {feature_key:string;enabled:boolean;allowed_roles:string[];expires_at:string|null;note:string;updated_at:string}[];
 return <main className="admin-area">
  <header className="admin-header"><div><Link href="/admin/businesses">← Business directory</Link><span className="badge badge-brand">PLATFORM ADMIN / BUSINESS</span><h1>{b.name}</h1><p>{b.slug} · {b.category} · Created {new Date(b.created_at).toLocaleDateString('en-NG')}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link href="/admin/support" className="btn">Support & role requests</Link><Link href="/admin/upgrades" className="btn">Review upgrades</Link><Link href={`/admin/billing?business=${encodeURIComponent(id)}`} className="btn">Payment history</Link></div></header>
  <div className="grid grid-3"><section className="card card-pad"><p className="small muted">Members</p><h2>{b.members.length}</h2></section><section className="card card-pad"><p className="small muted">Approved plan</p><h2>{b.plan_id||'Unassigned'}</h2></section><section className="card card-pad"><p className="small muted">Pending upgrades</p><h2>{b.pending_upgrades}</h2></section></div>
  <div className="grid grid-2" style={{marginTop:20}}>
   <section className="card card-pad"><h2>Workspace information</h2><p><strong>Email:</strong> {b.email||'Not provided'}</p><p><strong>Phone:</strong> {b.phone||'Not provided'}</p><p><strong>Location:</strong> {[b.city,b.state,b.country].filter(Boolean).join(', ')||'Not provided'}</p><p><strong>Publicly listed:</strong> {b.published?'Yes':'No'}</p><p><strong>Verified flag:</strong> {b.verified?'Yes':'No'}</p><p className="muted small">Verification controls public discovery only. A registered business can use its subscribed tools without waiting for listing verification.</p><form action={setVerifiedListing} style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}><input type="hidden" name="business_id" value={b.id}/><button className="btn btn-primary" type="submit" name="verified" value={b.verified?"false":"true"}>{b.verified?"Remove verification":"Verify for public listing"}</button></form></section>
   <section className="card card-pad"><BusinessReviewForm businessId={b.id} status={b.review?.status||'open'} note={b.review?.note||''}/></section>
  </div>
  <section className="card card-pad" style={{marginTop:20}}><h2>Subscription management</h2>
   <p className="small muted">Customers can pay and upgrade from their own billing page. As System Owner, you can also grant or change a plan directly for an agreed pilot or exception. Your access is limited to subscription administration, not their private transactions.</p>
   {availablePlansResult.error?<p role="alert">Plan choices are temporarily unavailable.</p>:<ManualPlanForm businessId={b.id} planId={b.plan_id} plans={availablePlansResult.data||[]}/>}
   {!manualAuditResult.error&&!!manualAuditResult.data?.length&&<details><summary>Recent manual subscription changes</summary><ul>{manualAuditResult.data.map(v=><li key={v.id}>{v.previous_plan_id||'Unassigned'} → {v.new_plan_id} · {new Date(v.changed_at).toLocaleDateString('en-NG')} · {v.reason}</li>)}</ul></details>}
  </section>
  <section className="card card-pad" style={{marginTop:20}}><h2>Business team</h2><div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th align="left">Member</th><th align="left">Role</th><th align="left">Joined</th></tr></thead><tbody>{b.members.map(m=><tr key={m.user_id}><td style={{padding:'10px 6px'}}>{m.full_name?.trim()||'Name not provided'}<div className="small muted">{m.user_id}</div></td><td>{m.role}</td><td>{new Date(m.joined_at).toLocaleDateString('en-NG')}</td></tr>)}</tbody></table></div>{!b.members.length&&<p>No members found.</p>}</section>
  <section className="card card-pad company-access-overview"><div className="admin-section-heading"><div><h2>What this company can actually use</h2><p className="muted small">Source of access: approved plan, inherited plan, or a separate company add-on. Built-in staff roles and named company roles can narrow access further.</p></div><Link href="/admin/plan-access" className="btn">Plan permissions</Link></div>
   <div className="grid grid-3"><div className="company-plan-stat"><strong>{essentialCapabilities.length}</strong><span>Core tools in every plan</span></div><div className="company-plan-stat"><strong>{paidCapabilities.filter(f=>fromPlan.has(f.key)).length}</strong><span>Modules from approved plan</span></div><div className="company-plan-stat"><strong>{activeExtras.size}</strong><span>Approved business extras</span></div></div>
   {(planFeaturesResult.error||parentResult.error||grantsResult.error)?<p role="alert">Unable to verify all access sources; do not make entitlement decisions based on this summary until the data loads successfully.</p>:<div className="company-feature-directory">{paidCapabilities.map(f=>{const included=fromPlan.has(f.key);const extra=activeExtras.has(f.key);const roles=grants.find(g=>g.feature_key===f.key);return <details className="company-feature-item" key={f.key}><summary><strong>{f.name}</strong><span className={`company-source-label ${included||extra?'active':''}`}>{included?'Plan included':extra?'Company extra':'Not enabled'}</span></summary><p className="small muted">{f.detail}</p><p className="small muted">{extra?`Extra approved for: ${roles?.allowed_roles.join(', ')||'selected staff'}`:included?'Staff must have the permitted plan role to use this module.':'Only the System Owner can approve this premium module.'}</p><ul>{(moduleWorkflows[f.key]||[]).map(w=><li key={w}>{w}</li>)}</ul></details>})}</div>}
   {b.plan_id==='free'&&activeExtras.size>0&&<p className="company-free-extras-note">This company remains on Free but has {activeExtras.size} separately approved premium extras. Review each grant and its expiry below; do not describe these as Free-plan inclusions.</p>}
  </section>
  <section className="card card-pad" style={{marginTop:20}}><h2>Business-specific feature access</h2><p className="muted">Individual add-ons are independent of the approved subscription. Granting a module here doesn't affect other businesses. Revoking an add-on cannot remove features inherited from the current plan.</p>
   {grantsResult.error?<p role="alert">Feature access settings are temporarily unavailable. Please try again later.</p>:<><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Module</th><th>Status</th><th>Allowed roles</th><th>Expiry</th></tr></thead><tbody>{grants.map(g=><tr key={g.feature_key}><td>{paidCapabilities.find(f=>f.key===g.feature_key)?.name||g.feature_key}</td><td>{!g.enabled?'Inactive':g.expires_at&&new Date(g.expires_at)<new Date()?'Expired':'Enabled'}</td><td>{g.allowed_roles.join(', ')}</td><td>{g.expires_at?new Date(g.expires_at).toLocaleDateString('en-NG'):'No expiry'}</td></tr>)}</tbody></table></div>{!grants.length&&<p className="muted">No extra modules granted.</p>}<FeatureGrantForm businessId={id} current={grants}/></>}
   <p className="small muted">Use <strong>Save business-specific grant</strong> below for one module at a time. On Free this is a courtesy/trial override, not part of the normal Free plan. An existing plan-included module cannot be removed using an extra-grant switch.</p>
   {!auditResult.error&&!!auditResult.data?.length&&<details><summary>Recent access changes</summary>{auditResult.data.map(a=><p key={a.id} className="small muted">{a.feature_key} · {new Date(a.changed_at).toLocaleString('en-NG')}</p>)}</details>}
  </section>
  <div className="grid grid-2" style={{marginTop:20}}>
    <section className="card card-pad"><h2>Custom pricing for this company</h2><p className="muted small">Quote a monthly or yearly rate for a selected module. This does not charge the customer or activate the module.</p>{pricesResult.error?<p role="alert">Company pricing is temporarily unavailable. Please try again later.</p>:<><CompanyPriceForm businessId={id} prices={prices}/><div className="company-price-list">{prices.map(p=><p key={p.feature_key}><strong>{paidCapabilities.find(f=>f.key===p.feature_key)?.name||p.feature_key}</strong> · {p.price_monthly_ngn===null?'Quote monthly':`₦${Number(p.price_monthly_ngn).toLocaleString('en-NG')}/month`} · {p.price_yearly_ngn===null?'Quote annually':`₦${Number(p.price_yearly_ngn).toLocaleString('en-NG')}/year`}</p>)}</div></>}</section>
    <section className="card card-pad"><h2>Company role assignments</h2><p className="muted small">Assign a named role like Cashier or Accounts Officer without silently promoting the staff member's secure base role.</p>{roleProfilesResult.error||roleAssignmentsResult.error?<p role="alert">Staff roles are temporarily unavailable. Please try again later.</p>:<><CompanyRoleAssignmentForm businessId={id} profiles={profiles} members={b.members} assigned={assignments}/><ul>{assignments.map(a=>{const member=b.members.find(m=>m.user_id===a.user_id);const profile=profiles.find(p=>p.id===a.profile_id);return <li key={a.user_id}>{member?.full_name||a.user_id.slice(0,8)} · {profile?.name||'Unknown profile'}</li>})}</ul></>}</section>
  </div>
  <section className="card card-pad" style={{marginTop:20}}><h2>Create and edit this company's roles</h2><p className="muted small">Custom roles are additional restrictions on existing security roles. They cannot grant subscription access, bypass approval workflows, or transfer ownership.</p>{roleProfilesResult.error?<p role="alert">Company roles are temporarily unavailable. Please try again later.</p>:<><CompanyRoleForm businessId={id} profiles={profiles}/><details><summary>Defined company roles ({profiles.length})</summary><ul>{profiles.map(p=><li key={p.id}><strong>{p.name}</strong> · Base: {p.base_role} · {p.active?'Active':'Inactive'} · {p.allowed_modules.join(', ')||'No premium modules'}</li>)}</ul></details></>}</section>
  {!!b.review_history?.length&&<section className="card card-pad" style={{marginTop:20}}><h2>Review history</h2>{b.review_history.map((h,i)=><p key={i} className="small muted">{h.status} · {new Date(h.changed_at).toLocaleString('en-NG')}</p>)}</section>}
 </main>;
}
