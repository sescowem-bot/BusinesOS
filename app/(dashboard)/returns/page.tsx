import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {BusinessPageHeading,BusinessAlert,BusinessSection,BusinessSummary} from '@/components/business-page-ui';
import {money} from '@/lib/format';
import {RequestReturnForm} from './forms';
export const dynamic='force-dynamic';
export default async function Returns(){
 const access=await requireBusinessFeature('pos');
 if(!access.allowed)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / CONTROL" title="Returns & credit notes" description="POS return management is available with the POS module."/><BusinessAlert>{access.reason}</BusinessAlert></div>;
 const {client,businessId,role}=access;
 const [salesResult,returnsResult]=await Promise.all([
  client.from('business_pos_sales').select('id,order_id').eq('business_id',businessId).order('created_at',{ascending:false}).limit(75),
  client.from('business_pos_returns').select('id,order_id,quantity,reason,status,gross_credit,requested_at').eq('business_id',businessId).order('requested_at',{ascending:false}).limit(100)
 ]);
 const sales=salesResult.data||[],recent=returnsResult.data||[];
 const saleIds=sales.map(x=>x.order_id);
 const filterIds=saleIds.length?saleIds:['00000000-0000-0000-0000-000000000000'];
 const [ordersResult,itemsResult]=await Promise.all([
  client.from('orders').select('id,order_number,customer_id,total,delivery_fee,status,payments(amount,status)').eq('business_id',businessId).in('id',filterIds).limit(75),
  client.from('order_items').select('id,order_id,name_snapshot,quantity,unit_price').in('order_id',filterIds).limit(1000)
 ]);
 const loadingError=salesResult.error||returnsResult.error||ordersResult.error||itemsResult.error;
 if(loadingError)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / CONTROL" title="Returns & credit notes" description="Return and refund records"/><BusinessAlert>Return records could not be verified. Confirm SQL 035 is installed and your POS permissions are enabled. No action is available until loading succeeds.</BusinessAlert></div>;
 const orders=ordersResult.data||[];
 const orderNames=new Map(orders.map(o=>[o.id,o.order_number]));
 const supported=new Set(orders.filter(o=>o.status!=='cancelled'&&Number(o.delivery_fee)===0&&
  Math.abs((o.payments||[]).filter(p=>p.status==='completed').reduce((n,p)=>n+Number(p.amount),0)-Number(o.total))<0.005).map(o=>o.id));
 const eligible=(itemsResult.data||[]).filter(i=>supported.has(i.order_id)).map(i=>({
  orderId:i.order_id,orderNumber:orderNames.get(i.order_id)||'POS order',id:i.id,
  name:i.name_snapshot,quantity:Number(i.quantity),unitPrice:Number(i.unit_price)
 }));
 const canRequest=['owner','manager','sales'].includes(role);
 const active=recent.filter(x=>x.status==='requested'||x.status==='approved').length;
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="SALES / CONTROL" title="Returns, refunds & credit notes" description="Request POS returns, record independent approval and issue credit notes only after actual refunds are confirmed." action={{href:'/pos',label:'Open POS'}}/>
  <BusinessSummary items={[{label:'Returns loaded',value:recent.length,detail:'Latest 100 maximum'},{label:'Awaiting action',value:active,detail:'Within loaded returns'},{label:'Completed returns',value:recent.filter(x=>x.status==='completed').length,detail:'Within loaded returns'}]}/>
  <BusinessAlert>Refunds are recorded only after external confirmation. This module does not transfer money. Original invoices, orders and positive payments stay unchanged. Existing gross sales dashboards and general-ledger reports do not yet net off credit notes; reconcile returns separately.</BusinessAlert>
  {(sales.length===75||recent.length===100||(itemsResult.data?.length||0)===1000)&&<BusinessAlert>Results are capped. Search source orders individually if your business has more records; the metrics above are not complete-period totals.</BusinessAlert>}
  <div className="grid grid-2">
   {canRequest&&<section className="card card-pad"><h2>New return request</h2>{eligible.length?<RequestReturnForm items={eligible}/>:<p className="muted">No eligible fully paid POS items in the loaded sales. Unpaid orders, delivery charges and non-POS orders require manual review.</p>}</section>}
   <section className="card card-pad"><h2>Control process</h2><ol className="bo-return-steps"><li>Choose a fully paid POS sale and item.</li><li>State the returned quantity and reason.</li><li>An authorised owner or manager approves the request.</li><li>Confirm an external refund, record its reference and select whether stock can be resold.</li><li>BusinessOS records the refund, credit note and optional stock restoration atomically.</li></ol><p className="small muted">You cannot return more than sold, approve a manager's own request, or complete a refund twice.</p></section>
  </div>
  <BusinessSection title="Return register" description="Review each request and open its immutable credit note after completion.">
   <div className="table-wrap"><table className="table"><thead><tr><th>Requested</th><th>Original order</th><th>Qty</th><th>Credit</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>
   {recent.map(r=><tr key={r.id}><td>{new Date(r.requested_at).toLocaleDateString('en-NG')}</td><td><Link href={`/orders/${r.order_id}`}>{orderNames.get(r.order_id)||'Open order'}</Link></td><td>{Number(r.quantity)}</td><td>{money(Number(r.gross_credit))}</td><td>{r.reason}</td><td><strong>{r.status}</strong></td><td><Link href={`/returns/${r.id}`}>Review / details</Link></td></tr>)}
   </tbody></table></div>{!recent.length&&<p className="muted">No returns have been requested.</p>}
  </BusinessSection>
 </div>;
}
