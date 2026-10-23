import {customerNameFromRelation} from '@/lib/customer-relations';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
import type {RecordItem} from '@/components/business-records';
import {parseDirectory,DIRECTORY_SIZE,type DirectoryRaw} from '@/lib/record-directory';
import {ServerRecordRegister} from '@/components/server-record-register';
export const dynamic='force-dynamic';
export default async function Orders({searchParams}:{searchParams:Promise<DirectoryRaw>}){
 const {client,businessId,role}=await getWorkspace();
 const canRecord=['owner','manager','finance','sales'].includes(role);
 const params=parseDirectory(await searchParams);
 let query=client.from('orders')
  .select('id,order_number,total,status,created_at,due_date,customer_id,payments(amount,status)',{count:'exact'})
  .eq('business_id',businessId);
 if(params.q)query=query.ilike('order_number','%'+params.q+'%');
 if(params.customer)query=query.eq('customer_id',params.customer);
 const {data,error,count}=await query.order('created_at',{ascending:false}).order('id',{ascending:false})
  .range(params.offset,params.offset+DIRECTORY_SIZE-1);
 if(error)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / ORDERS" title="Orders & sales" description="Find customer orders and payment history."/><BusinessAlert>Order records could not be verified. Please retry; no financial totals are shown.</BusinessAlert></div>;
 const orders=data||[];
 const ids=Array.from(new Set(orders.map(o=>o.customer_id).filter((v):v is string=>typeof v==='string'&&!!v)));
 const customers=ids.length?await client.from('business_customers').select('customer_id,customers(name)')
  .eq('business_id',businessId).in('customer_id',ids):{data:[],error:null};
 const names=new Map<string,string>((customers.data||[]).map(v=>[v.customer_id,customerNameFromRelation(v.customers,'Customer')]));
 const rows:RecordItem[]=orders.map(o=>{
  const amount=Number(o.total)||0;
  const paid=(o.payments||[]).filter(p=>p.status==='completed').reduce((s,p)=>s+(Number(p.amount)||0),0);
  const cancelled=o.status==='cancelled';
  const due=cancelled?0:Math.max(0,amount-paid);
  const state=cancelled?'Cancelled':amount<=0?'No charge':due<=0?'Paid':paid>0?'Part paid':'Unpaid';
  return {id:o.id,filter:state,search:[o.order_number,names.get(o.customer_id),state].filter(Boolean).join(' '),cells:[
   {text:o.order_number||'View order',href:`/orders/${o.id}`,kind:'strong'},
   {text:names.get(o.customer_id)||'Walk-in'},{text:money(amount),kind:'amount'},
   {text:money(paid),kind:'amount'},{text:money(due),kind:'amount'},
   {text:state,kind:'status',tone:state==='Paid'?'success':cancelled?'danger':'warning'},
   {text:new Date(o.created_at).toLocaleDateString('en-NG'),kind:'muted'},
   {text:cancelled?'View order':due>0&&canRecord?'Review / receive payment':'Open order',
    href:`/orders/${o.id}${due>0&&!cancelled?'#payment-history':''}`,kind:'strong'}
  ]};
 });
 const active=orders.filter(o=>o.status!=='cancelled');
 const value=active.reduce((n,o)=>n+(Number(o.total)||0),0);
 const received=active.reduce((n,o)=>n+(o.payments||[]).filter(p=>p.status==='completed').reduce((sum,p)=>sum+(Number(p.amount)||0),0),0);
 const outstanding=active.reduce((n,o)=>{
  const paid=(o.payments||[]).filter(p=>p.status==='completed').reduce((sum,p)=>sum+(Number(p.amount)||0),0);
  return n+Math.max(0,(Number(o.total)||0)-paid);
 },0);
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="SALES / ORDERS" title="Orders & sales"
   description={params.customer?'Orders for your selected customer. Search order numbers or return to all orders.':'Search any order number, including older transactions. Open an order to review individual payments.'}
   action={canRecord?{href:'/orders/new',label:'New order'}:undefined}/>
  <BusinessSummary items={[{label:params.q||params.customer?'Matching orders':'All recorded orders',value:count??'—',detail:'Complete matching register'},{label:'Order value on this page',value:money(value),detail:'Excludes cancelled orders'},{label:'Received on this page',value:money(received)},{label:'Outstanding on this page',value:money(outstanding),warning:outstanding>0}]}/>
  {customers.error&&<BusinessAlert>Customer names are temporarily unavailable. Order amounts remain linked to the individual records shown.</BusinessAlert>}
  <section className="bo-guide-strip" aria-label="Understanding payment status"><strong>Understanding payment status</strong><p><span><b>Unpaid</b> No completed payment recorded</span><span><b>Part paid</b> Some money received</span><span><b>Paid</b> Fully settled</span></p></section>
  <BusinessSection title="Order register" description="Use the search box for order numbers. Payment totals are calculated from the payments linked to each listed order.">
   <ServerRecordRegister route="/orders" columns={['Order','Customer','Value','Received','Outstanding','Status','Created','Next step']}
    rows={rows} count={count} page={params.page} pageSize={DIRECTORY_SIZE} q={params.q} customer={params.customer}
    searchLabel="Search by order number" emptyTitle="No orders recorded yet"
    emptyDescription="Create an order to begin tracking amounts received and remaining balances."
    emptyHref={canRecord?'/orders/new':undefined} emptyAction={canRecord?'Create order':undefined}
    note="Summary amounts relate only to the current page. Review reports for complete-period totals. Cancelled orders do not contribute to outstanding balances."/>
  </BusinessSection>
 </div>;
}
