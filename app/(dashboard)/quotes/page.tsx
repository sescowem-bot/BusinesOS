import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
export const dynamic='force-dynamic';
export default async function Quotes(){
 const {client,businessId}=await getWorkspace();
 const {data,error}=await client.from('quotes').select('id,quote_number,status,total,expires_at,created_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(200);
 if(error)return <div className="tax-page"><h1>Quotes</h1><section className="tax-panel" role="alert"><h2>We couldn’t load your quotes</h2><p>Please try again. If this continues, contact support.</p><a className="btn" href="/quotes">Try again</a></section></div>;
 return <div className="tax-page"><p className="small muted">BUSINESS / SALES</p><h1>Quotes</h1><p className="muted">Review saved quotations. Creating a new quote or turning one into an order is not available here yet.</p><section className="tax-panel"><div className="table-wrap"><table className="table"><thead><tr><th>Quote</th><th>Total</th><th>Status</th><th>Expires</th><th>Created</th></tr></thead><tbody>{(data||[]).map(q=><tr key={q.id}><td>{q.quote_number}</td><td>{money(Number(q.total))}</td><td>{q.status}</td><td>{q.expires_at||'—'}</td><td>{new Date(q.created_at).toLocaleDateString('en-NG')}</td></tr>)}</tbody></table></div>{!data?.length&&<p className="muted">No quotations have been created yet.</p>}</section></div>;
}
