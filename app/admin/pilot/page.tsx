import Link from 'next/link';
import {ArrowRight,ClipboardCheck,ShieldAlert,ShieldCheck,ExternalLink} from 'lucide-react';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {allPilotChecks,pilotGroups,type PilotEnvironment,type PilotStatus} from '@/lib/pilot-checklist';
import {PilotReviewForm} from './review-form';
export const dynamic='force-dynamic';
type RecordRow={test_id:string;status:PilotStatus;evidence:string;reviewed_at:string};
type PageProps={searchParams:Promise<{environment?:string}>};
export default async function PilotReadiness({searchParams}:PageProps){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-area" role="alert">Platform administrator access required.</main>;
 const params=await searchParams;
 const environment:PilotEnvironment=params.environment==='production'?'production':'preview';
 const [records,pages,plans,brand]=await Promise.all([
  session.client.from('platform_pilot_results').select('test_id,status,evidence,reviewed_at').eq('environment',environment),
  session.client.from('public_site_pages').select('slug,published'),
  session.client.from('public_site_plans').select('id,published'),
  session.client.from('platform_branding').select('name,logo_url,favicon_url').eq('id',true).maybeSingle()
 ]);
 const results=new Map<string,RecordRow>((records.data||[]).map((r):[string,RecordRow]=>[r.test_id,r as RecordRow]));
 const count=(status:PilotStatus)=>allPilotChecks.filter(c=>(results.get(c.id)?.status||'not_tested')===status).length;
 const criticalMissing=allPilotChecks.filter(c=>c.critical&&results.get(c.id)?.status!=='pass');
 const policies=['terms','privacy','cookies'];
 const legal=policies.map(slug=>({slug,published:!!pages.data?.find(p=>p.slug===slug&&p.published)}));
 const publicPlans=(plans.data||[]).filter(p=>p.published).length;
 const envChecks=[
  {name:'Supabase project configuration',ok:!!process.env.NEXT_PUBLIC_SUPABASE_URL&&!!(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),detail:'Environment variable presence only, not a connection test.'},
  {name:'At least one published pricing plan',ok:!plans.error&&publicPlans>0,detail:plans.error?'Could not read plan settings.':`${publicPlans} published plan(s).`},
  {name:'Legal page publication',ok:!pages.error&&legal.every(p=>p.published),detail:pages.error?'Could not read CMS publication status.':legal.map(p=>`${p.slug}: ${p.published?'published':'not published'}`).join(' · ')},
  {name:'Configured platform logo and favicon',ok:!brand.error&&!!brand.data?.logo_url&&!!brand.data?.favicon_url,detail:brand.error?'Could not read branding.':'Presence of asset URLs only; test actual image loading separately.'},
  {name:'Resend test delivery credentials',ok:!!process.env.RESEND_API_KEY&&!!process.env.RESEND_FROM_EMAIL,detail:'Environment variable presence only; no email sent.'},
 ];
 return <main className="admin-area pilot-readiness-page">
  <header className="owner-page-heading pilot-header"><div><div className="owner-eyebrow"><ClipboardCheck size={16}/> RELEASE CONTROL / PHASE 030</div><h1>Pilot readiness</h1><p>Track real test evidence before a controlled launch. A saved pass is a manual administrator review—not an automated certification.</p></div><Link href="/admin/health" className="btn">System diagnostics <ArrowRight size={15}/></Link></header>
  <div className="owner-alert" role="status"><ShieldAlert size={21}/><div><strong>Commercial launch is not automatically authorised</strong><p>Critical tests require independently verified results, including build, tenant isolation, transactions and financial integrity. Publishing this page never changes live access or enables email delivery.</p></div></div>
  <div className="pilot-env-switch" role="group" aria-label="Test environment"><span>Review environment</span><Link aria-current={environment==='preview'?'page':undefined} className={environment==='preview'?'is-current':''} href="/admin/pilot?environment=preview">Vercel Preview</Link><Link aria-current={environment==='production'?'page':undefined} className={environment==='production'?'is-current':''} href="/admin/pilot?environment=production">Production</Link></div>
  <div className="pilot-summary-grid"><div className="pilot-summary"><small>Recorded passes</small><strong>{count('pass')} / {allPilotChecks.length}</strong><span>Require reviewable evidence</span></div><div className="pilot-summary"><small>Not tested</small><strong>{count('not_tested')}</strong><span>Still require actual execution</span></div><div className="pilot-summary"><small>Failed or blocked</small><strong>{count('fail')+count('blocked')}</strong><span>Resolve before launch</span></div><div className="pilot-summary"><small>Critical not passed</small><strong>{criticalMissing.length}</strong><span>Prevent release sign-off</span></div></div>
  {records.error&&<section className="owner-alert" role="alert"><ShieldAlert size={19}/><div><strong>Pilot tracking is not yet available</strong><p>Apply additive database migration 028 after 027. Checklist updates cannot be stored until then.</p></div></section>}
  <section className="owner-panel pilot-infrastructure"><div className="owner-panel-heading"><div><h2>Read-only configuration checks</h2><p>These are signals, not proof of end-to-end functionality.</p></div></div><div className="pilot-config-list">{envChecks.map(c=><div className="pilot-config-row" key={c.name}><span className={c.ok?'pilot-dot is-present':'pilot-dot is-missing'} aria-hidden="true"/><div><strong>{c.name}</strong><small>{c.detail}</small></div><span className="pilot-config-status">{c.ok?'Configured / observable':'Attention needed'}</span></div>)}</div></section>
  <div className="pilot-content-heading"><div><h2>Acceptance test register</h2><p>Choose a test, run it using appropriate preview accounts, then record a redacted result and evidence reference. Production reviews are tracked separately.</p></div><Link href="/admin/businesses" className="btn">Business directory <ExternalLink size={14}/></Link></div>
  {pilotGroups.map(group=><details className="owner-panel pilot-group" key={group.name} open={group.name==='Authentication and account security'}><summary>{group.name}<span>{group.checks.filter(c=>results.get(c.id)?.status==='pass').length}/{group.checks.length} recorded passes</span></summary><div className="pilot-check-list">{group.checks.map(check=>{const result=results.get(check.id);const status=result?.status||'not_tested';return <details key={check.id} className="pilot-check"><summary><span className="pilot-test-id">{check.id}</span><span className="pilot-check-label"><strong>{check.name}</strong><small>{check.expected}</small></span><span className={`pilot-status pilot-status-${status}`}>{status.replace('_',' ')}</span>{check.critical&&<span className="pilot-critical">Critical</span>}</summary><div className="pilot-check-editor">{result?.reviewed_at&&<p className="muted small">Last saved: {new Date(result.reviewed_at).toLocaleString('en-NG')}</p>}{records.error?<p role="alert">Review storage unavailable. Test can be performed but cannot be recorded.</p>:<PilotReviewForm key={`${environment}:${check.id}:${result?.reviewed_at||''}`} testId={check.id} environment={environment} status={status} evidence={result?.evidence||''}/>}</div></details>})}</div></details>)}
  <section className="owner-panel pilot-release-summary"><ShieldCheck size={28}/><div><h2>Release decision remains manual</h2><p>{criticalMissing.length} critical tests have not been recorded as passed for <strong>{environment}</strong>. Even if all tests are marked passed, a separate qualified review of evidence, database integrity, security and provider configuration is required before serving real customers.</p><p className="muted small">Checklist activity is audited by the database. Test results do not alter subscriptions, platform configuration or deployment state.</p></div></section>
 </main>;
}
