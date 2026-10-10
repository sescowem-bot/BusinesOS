import {customerNameFromRelation} from '@/lib/customer-relations';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
import {BusinessRecordsTable,type RecordItem} from '@/components/business-records';
export const dynamic='force-dynamic';
export default async function Orders(){
 const {client,businessId,role}=await getWorkspace();
 const canRecordPayment=['owner','manager','finance','sales'].includes(role);
 const [ordersResult,customersResult]=await Promise.all([
  client.from('orders').select('id,order_number,total,status,created_at,due_date,customer_id,payments(amount,status)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(200),
  client.from('business_customers').select('customer_id,customers(name)').eq('business_id',businessId).limit(500)
 ]);
 if(ordersResult.error||customersResult.error)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / ORDERS" title="Orders & sales" description="Review customer orders and their recorded payments."/><BusinessAlert>Order data could not be loaded or verified. Please retry; no financial totals are shown.</BusinessAlert></div>;
 const orders=ordersResult.data||[];
 const names=new Map<string,string>((customersResult.data||[]).map(v=>[v.customer_id,customerNameFromRelation(v.customers, 'Customer')]));
 let total=0,received=0,balance=0,open=0;
 const rows:RecordItem[]=orders.map(o=>{
  const amount=Number(o.total)||0;
  const paid=(o.payments||[]).filter(p=>p.status==='completed').reduce((s,p)=>s+(Number(p.amount)||0),0);
  const due=Math.max(0,amount-paid);
  if(o.status!=='cancelled'){total+=amount;received+=paid;balance+=due;if(due>0)open++}
  const status=o.status==='cancelled'?'Cancelled':amount<=0?'No charge':due<=0?'Paid':paid>0?'Part paid':'Unpaid';
  const actionLabel=o.status==='cancelled'?'View order':due>0?(canRecordPayment?'Review / receive payment':'Review balance'):'View order';
  return {id:o.id,filter:status,search:[o.order_number,names.get(o.customer_id),status,o.created_at].filter(Boolean).join(' '),cells:[
   {text:o.order_number||'View order',href:`/orders/${o.id}`,kind:'strong'},
   {text:names.get(o.customer_id)||'Walk-in'},{text:money(amount),kind:'amount'},
   {text:money(paid),kind:'amount'},{text:money(due),kind:'amount'},
   {text:status,kind:'status',tone:status==='Paid'?'success':status==='Cancelled'?'danger':'warning'},
   {text:new Date(o.created_at).toLocaleDateString('en-NG'),kind:'muted'},
   {text:actionLabel,href:`/orders/${o.id}${due>0&&o.status!=='cancelled'?'#payment-history':''}`,kind:'strong'}
  ]};
 });
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="SALES / ORDERS" title="Orders & sales" description="Track order status, recorded payments and outstanding balances. Open any order to collect payments or issue a commercial invoice." action={canRecordPayment?{href:'/orders/new',label:'New order'}:undefined}/>
  <BusinessSummary items={[{label:'Order value in loaded list',value:money(total),detail:'Excludes cancelled orders'},{label:'Completed payments',value:money(received),detail:'On listed orders'},{label:'Outstanding balances',value:money(balance),detail:`${open} open orders`,warning:balance>0},{label:'Orders in loaded list',value:orders.length,detail:'Latest 200 maximum'}]}/>
  {orders.length===200&&<BusinessAlert>Only the newest 200 orders are loaded. Financial totals above are not complete-period figures; use your reconciled reports.</BusinessAlert>}
  <section className="bo-guide-strip" aria-label="Understanding order payment status"><strong>Understanding payment status</strong><p><span><b>Unpaid</b> No payment recorded</span><span><b>Part paid</b> Some money received</span><span><b>Paid</b> Fully settled</span></p></section>
  <BusinessSection title="Order register" description="Search by order number or customer, filter by payment status, or select Review / receive payment to see what is outstanding.">
   <BusinessRecordsTable columns={['Order','Customer','Value','Received','Outstanding','Status','Created','Next step']} rows={rows} searchLabel="Search orders or customers" emptyTitle="No orders recorded yet" emptyDescription="Create a sales order and link it to a customer to start tracking payments." emptyHref="/orders/new" emptyAction="Create order" limitNote="Payments reflect completed entries linked to each loaded order; cancellation and refund workflows require separate review."/>
  </BusinessSection>
 </div>;
}
