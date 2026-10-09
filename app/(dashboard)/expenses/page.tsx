import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
export const dynamic='force-dynamic';
export default async function Expenses(){
 const {client,businessId}=await getWorkspace();
 const {data,error}=await client.from('expenses').select('id,description,amount,paid_at,expense_categories(name)').eq('business_id',businessId).order('paid_at',{ascending:false}).limit(200);
 if(error)throw new Error('Unable to load expenses. Verify business access and database configuration.');
 const rows=data||[];const total=rows.reduce((v,e)=>v+Number(e.amount),0);
 return <div className="tax-page"><p className="small muted">BUSINESS / FINANCE</p><h1>Expenses</h1><p className="muted">Recorded expenses for your business. No demonstration transactions are shown.</p><section className="tax-panel"><p className="small muted">Total of displayed {rows.length} records</p><h2>{money(total)}</h2></section><section className="tax-panel"><h2>Expense register</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td>{new Date(e.paid_at).toLocaleDateString('en-NG')}</td><td>{Array.isArray(e.expense_categories)?e.expense_categories[0]?.name||'Uncategorised':(e.expense_categories as {name?:string}|null)?.name||'Uncategorised'}</td><td>{e.description}</td><td>{money(Number(e.amount))}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="muted">No expenses recorded. Expense creation is not enabled yet; no example entries have been inserted.</p>}{rows.length===200&&<p className="muted small">Latest 200 records shown. Totals are not full-period reports.</p>}</section></div>;
}
