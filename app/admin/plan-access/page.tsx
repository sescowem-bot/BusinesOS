import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {setPlanFeature} from './actions';
export const dynamic='force-dynamic';
const features=['accounting','tax','financial_reports','communications','campaigns','inventory','insights','growth','team'];
export default async function PlanAccessPage(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><h1>Administrator access required</h1><Link href="/login">Sign in</Link></main>;
 const [plansResult,accessResult]=await Promise.all([
 session.client.from('public_site_plans').select('id,name,published').order('sort_order'),
 session.client.from('platform_plan_features').select('plan_id,feature_key,enabled')
 ]);
 if(plansResult.error||accessResult.error)return <main className="admin-area"><h1>Plan access</h1><p role="alert">Unable to load entitlements. Apply migration 019.</p></main>;
 const access=new Map((accessResult.data||[]).map(x=>[`${x.plan_id}:${x.feature_key}`,x.enabled]));
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">PLATFORM SUPER ADMIN</span><h1>Plan feature access</h1><p>Configure which premium modules each approved plan unlocks. Changes affect existing assignments to this plan.</p></div><Link className="btn" href="/admin">Back to admin</Link></header>
 {(plansResult.data||[]).map(plan=><section className="card card-pad" style={{marginBottom:18}} key={plan.id}><h2>{plan.name} {plan.published?'':'(Unpublished)'}</h2><div className="grid grid-3">{features.map(feature=>{const enabled=access.get(`${plan.id}:${feature}`)===true;return <form action={setPlanFeature} key={feature} className="tax-panel"><input type="hidden" name="plan_id" value={plan.id}/><input type="hidden" name="feature_key" value={feature}/><input type="hidden" name="enabled" value={String(!enabled)}/><p><strong>{feature.replaceAll('_',' ')}</strong></p><p className="small muted">{enabled?'Enabled':'Disabled'}</p><button type="submit" className="btn">{enabled?'Disable':'Enable'}</button></form>})}</div></section>)}
 <p className="muted small">Core access remains available for dashboard, customers, orders, products, payments, expenses, settings and upgrades. This UI enforces page access, but all underlying APIs and database operations require further entitlement checks before production billing.</p></main>;
}
