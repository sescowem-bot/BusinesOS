import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
import {BusinessRecordsTable,type RecordItem} from '@/components/business-records';
export const dynamic='force-dynamic';
export default async function Payments(){
 const {client,businessId}=await getWorkspace();
 const [paymentsResult,ordersResult]=await Promise.all([
  client.from('payments').select('id,order_id,amount,method,status,reference,paid_at').eq('business_id',businessId).order('paid_at',{ascending:false}).limit(200),
  client.from('orders').select('id,order_number,total,status,payments(amount,status)').eq('business_id',businessId).limit(200)
 ]);
 if(paymentsResult.error||ordersResult.error)return <div className="bo-page"><BusinessPageHeading eyebrow="FINANCE / PAYMENTS" title="Customer payments" description="Follow recorded receipts and outstanding customer balances."/><BusinessAlert>Payment and order records could not be verified. Please retry before relying on financial amounts.</BusinessAlert></div>;
 const payments=paymentsResult.data||[],orders=ordersResult.data||[];
 const names=new Map(orders.map(o=>[o.id,o.order_number]));
 const completed=payments.filter(p=>p.status==='completed');
 const received=completed.reduce((sum,p)=>sum+(Number(p.amount)||0),0);
 const outstanding=orders.filter(o=>o.status!=='cancelled').reduce((sum,o)=>sum+Math.max(0,(Number(o.total)||0)-(o.payments||[]).filter(p=>p.status==='completed').reduce((v,p)=>v+(Number(p.amount)||0),0)),0);
 const rows:RecordItem[]=payments.map(p=>{
  const status=p.status==='completed'?'Completed':p.status||'Unknown';
  return {id:p.id,filter:status,search:[names.get(p.order_id),p.reference,p.method,status].filter(Boolean).join(' '),cells:[
   {text:new Date(p.paid_at).toLocaleDateString('en-NG'),kind:'muted'},
   {text:names.get(p.order_id)||'Open order',href:`/orders/${p.order_id}`,kind:'strong'},
   {text:money(Number(p.amount)||0),kind:'amount'},{text:p.method||'—'},
   {text:status,kind:'status',tone:status==='Completed'?'success':status==='failed'?'danger':'warning'},
   {text:p.reference||'—',kind:'muted'},
   p.status==='completed'?{text:'Print acknowledgement',href:`/payments/${p.id}`}:{text:'—',kind:'muted'}
  ]};
 });
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="FINANCE / PAYMENTS" title="Customer payments" description="Monitor manually recorded payments and open their linked orders. No online gateway is connected." action={{href:'/orders',label:'Find an order'}}/>
  <BusinessSummary items={[{label:'Completed receipts in loaded list',value:money(received),detail:`${completed.length} payments`},{label:'Outstanding on loaded orders',value:money(outstanding),detail:'Excludes cancelled orders',warning:outstanding>0},{label:'Payment entries',value:payments.length,detail:'Latest 200 maximum'}]}/>
  {(payments.length===200||orders.length===200)&&<BusinessAlert>The payment or order list has reached its 200-record limit. The summary may be incomplete; use reconciled financial reports for complete figures.</BusinessAlert>}
  <BusinessSection title="Payment history" description="Search by order number, reference or payment method, then open completed payment acknowledgements.">
   <BusinessRecordsTable columns={['Paid on','Order','Amount','Method','Status','Reference','Document']} rows={rows} searchLabel="Search payments or references" emptyTitle="No payments recorded yet" emptyDescription="Create an order, then open it to record a payment." emptyHref="/orders" emptyAction="View orders" limitNote="Only completed payments count as received. Payment acknowledgement documents confirm recorded entries, not independent bank settlement."/>
  </BusinessSection>
 </div>;
}
