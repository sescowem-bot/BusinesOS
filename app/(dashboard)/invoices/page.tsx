import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
export const dynamic='force-dynamic';

export default async function Invoices(){
 const {client,businessId}=await getWorkspace();
 const [invoicesResult,ordersResult,linksResult]=await Promise.all([
  client.from('business_invoices').select('id,invoice_number,order_id,issued_at,snapshot').eq('business_id',businessId).order('issued_at',{ascending:false}).limit(100),
  client.from('orders').select('id,order_number,total,status,created_at,customer_id,payments(amount,status)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(100),
  client.from('business_customers').select('customer_id,customers(name)').eq('business_id',businessId)
 ]);
 if(ordersResult.error||linksResult.error)throw new Error('Unable to load business orders. Check permissions and migrations.');
 const invoiceAvailable=!invoicesResult.error;
 const issued=invoicesResult.data||[];
 const names=new Map((linksResult.data||[]).map((v:any)=>[v.customer_id,Array.isArray(v.customers)?v.customers[0]?.name:v.customers?.name]));
 const issuedOrderIds=new Set(issued.map(i=>i.order_id));
 return <div className="tax-page">
  <p className="small muted">BUSINESS / DOCUMENTS</p><h1>Invoices and receipts</h1>
  <p className="muted">Issue numbered commercial invoices from saved orders. Invoice snapshots are preserved; payments remain linked to the original order.</p>
  <p><Link className="btn primary" href="/orders/new">Create order</Link></p>
  {!invoiceAvailable&&<section className="tax-panel" role="alert"><h2>Invoice issuance not active</h2><p>Commercial invoice records are unavailable. Apply migration 022 after your existing migrations. You can still print order statements below.</p></section>}
  {invoiceAvailable&&<section className="tax-panel"><h2>Issued commercial invoices</h2><div className="table-wrap"><table className="table"><thead><tr><th>Invoice number</th><th>Customer</th><th>Total at issue</th><th>Issue date</th><th>View</th></tr></thead><tbody>
   {issued.map(i=>{const s=i.snapshot as {customer?:{name?:string};total?:number};return <tr key={i.id}><td>{i.invoice_number}</td><td>{s?.customer?.name||'Walk-in'}</td><td>{money(Number(s?.total||0))}</td><td>{new Date(i.issued_at).toLocaleDateString('en-NG')}</td><td><Link href={`/invoices/issued/${i.id}`}>View / print</Link></td></tr>})}
  </tbody></table></div>{!issued.length&&<p className="muted">No commercial invoices have been issued yet.</p>}{issued.length===100&&<p className="muted small">Showing latest 100 invoices only.</p>}</section>}
  <section className="tax-panel"><h2>Orders and statements</h2><p className="muted small">Open an order to issue its invoice, or print its current payment statement.</p>
   <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Outstanding</th><th>Invoice</th><th>Actions</th></tr></thead><tbody>
   {(ordersResult.data||[]).map(o=>{const paid=(o.payments||[]).filter(p=>p.status==='completed').reduce((a,p)=>a+Number(p.amount),0);return <tr key={o.id}><td>{o.order_number}</td><td>{names.get(o.customer_id)||'Walk-in'}</td><td>{money(Number(o.total))}</td><td>{money(Math.max(0,Number(o.total)-paid))}</td><td>{!invoiceAvailable?'Unavailable':issuedOrderIds.has(o.id)?'Issued':'Check order'}</td><td><Link href={`/orders/${o.id}`}>Open order</Link> · <Link href={`/invoices/${o.id}`}>Statement</Link></td></tr>})}
   </tbody></table></div>{!ordersResult.data?.length&&<p className="muted">No orders have been created.</p>}{ordersResult.data?.length===100&&<p className="muted small">Latest 100 orders displayed; this is not a complete financial report.</p>}
  </section>
 </div>;
}
