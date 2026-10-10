import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
export const dynamic='force-dynamic';

type SourceEvent={id:string;source_type:string;source_id:string;status:string;journal_id:string|null;occurred_at:string;attempts:number;last_error:string|null};
export default async function AccountingReconciliation(){
 const access=await requireBusinessFeature('accounting');
 if(!access.allowed)return <section className="tax-page"><h1>Access restricted</h1><p role="alert">{access.reason}</p><Link href="/upgrade">View plans</Link></section>;
 if(!['owner','manager','finance'].includes(access.role))return <section className="tax-page"><h1>Accounting reconciliation</h1><p role="alert">Finance permission required.</p></section>;
 const {client,businessId}=access;
 const [settings,rowsResult,pendingResult,errorResult,postedResult]=await Promise.all([
  client.from('gl_integration_settings').select('enabled').eq('business_id',businessId).maybeSingle(),
  client.from('gl_source_events').select('id,source_type,source_id,status,journal_id,occurred_at,attempts,last_error').eq('business_id',businessId).order('occurred_at',{ascending:false}).limit(100),
  client.from('gl_source_events').select('id',{head:true,count:'exact'}).eq('business_id',businessId).eq('status','pending'),
  client.from('gl_source_events').select('id',{head:true,count:'exact'}).eq('business_id',businessId).eq('status','error'),
  client.from('gl_source_events').select('id',{head:true,count:'exact'}).eq('business_id',businessId).eq('status','posted')
 ]);
 if([settings.error,rowsResult.error,pendingResult.error,errorResult.error,postedResult.error].some(Boolean))return <section className="tax-page"><h1>Accounting reconciliation</h1><p role="alert">Posting records could not be verified. Check migration 024 and your finance permissions.</p></section>;
 const rows=(rowsResult.data||[]) as SourceEvent[];
 const orphaned=rows.filter(r=>r.status==='posted'&&!r.journal_id);
 const unresolved=(pendingResult.count||0)+(errorResult.count||0);
 return <div className="tax-page"><p className="muted small">FINANCE / SOURCE RECONCILIATION</p><h1>Accounting source reconciliation</h1><p className="muted">Compare issued invoices, completed payments and paid expenses captured for posting against the general ledger queue. This is not a bank statement reconciliation.</p>
 <div className="grid grid-3"><section className="tax-panel"><p className="small muted">Posted source events</p><h2>{postedResult.count??0}</h2></section><section className="tax-panel"><p className="small muted">Awaiting posting</p><h2>{pendingResult.count??0}</h2></section><section className="tax-panel"><p className="small muted">Posting errors</p><h2>{errorResult.count??0}</h2></section></div>
 <section className="tax-panel"><h2>Posting readiness</h2><p>Integration: <strong>{settings.data?.enabled?'Enabled':'Paused or not configured'}</strong></p>
 {unresolved>0?<p role="alert" className="negative">{unresolved} captured source transactions have not posted successfully. Financial reports may exclude them.</p>:<p className="small muted">No pending or failed events in the captured queue. Older unimported transactions and manual entries may still require review.</p>}
 {orphaned.length>0&&<p role="alert" className="negative">{orphaned.length} posted records in this sample have no linked journal ID; investigate before relying on reports.</p>}
 <p className="small muted">Counts include all recorded source events; the table below is limited to the newest 100. Historical sales and expenses might not be in this queue until you explicitly discover them.</p>
 <Link className="btn" href="/accounting">Review setup and retry failed events</Link></section>
 <section className="tax-panel"><h2>Recent source-to-ledger matches</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Source</th><th>Posting status</th><th>Journal linked</th><th>Attempts</th><th>Exception</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{new Date(row.occurred_at).toLocaleDateString('en-NG')}</td><td>{row.source_type}<span className="muted small"> · {row.source_id.slice(0,8)}</span></td><td>{row.status}</td><td>{row.journal_id?'Yes':'No'}</td><td>{row.attempts}</td><td>{row.last_error||'—'}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="muted">No events captured yet. Create new invoices, payments or paid expenses, or carefully discover historical sources.</p>}</section>
 <p className="small muted">A complete close also requires bank reconciliation, opening balances, returns, credit notes, manual journal review, posted tax treatment and professional accounting review. This page does not certify the ledger.</p>
 </div>;
}
