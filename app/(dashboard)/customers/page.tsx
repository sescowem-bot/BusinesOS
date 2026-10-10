import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
import {BusinessRecordsTable,type RecordItem} from '@/components/business-records';
export const dynamic='force-dynamic';

type CustomerLink={customer_id:string;customers:{name?:string;phone?:string|null;email?:string|null}|{name?:string;phone?:string|null;email?:string|null}[]|null};
export default async function Customers(){
 const {client,businessId}=await getWorkspace();
 const [linksResult,ordersResult,paymentsResult]=await Promise.all([
  client.from('business_customers').select('customer_id,customers(name,phone,email)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(250),
  client.from('orders').select('customer_id,total,status').eq('business_id',businessId).limit(1000),
  client.from('payments').select('customer_id,amount,status').eq('business_id',businessId).limit(1000)
 ]);
 const error=linksResult.error||ordersResult.error||paymentsResult.error;
 if(error)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / CUSTOMERS" title="Customers" description="Keep your customers, orders and payments organised in one place."/><BusinessAlert>Customer and balance data could not be verified. Please try again or contact support. No figures have been estimated.</BusinessAlert></div>;
 const links=(linksResult.data||[]) as CustomerLink[];
 const orders=ordersResult.data||[],payments=paymentsResult.data||[];
 const orderTotals=new Map<string,{count:number;total:number}>();
 for(const o of orders){if(o.status==='cancelled'||!o.customer_id)continue;const v=orderTotals.get(o.customer_id)||{count:0,total:0};v.count++;v.total+=Number(o.total)||0;orderTotals.set(o.customer_id,v)}
 const paymentTotals=new Map<string,number>();
 for(const p of payments){if(p.status!=='completed'||!p.customer_id)continue;paymentTotals.set(p.customer_id,(paymentTotals.get(p.customer_id)||0)+(Number(p.amount)||0))}
 const rows:RecordItem[]=links.map(link=>{
  const c=Array.isArray(link.customers)?link.customers[0]:link.customers;
  const sale=orderTotals.get(link.customer_id)||{count:0,total:0};const paid=paymentTotals.get(link.customer_id)||0;
  const balance=Math.max(0,sale.total-paid);
  const filter=balance>0?'Balance due':sale.count?'No balance due':'No orders';
  const name=c?.name||'Unnamed customer';
  return {id:link.customer_id,filter,search:[name,c?.phone,c?.email,filter].filter(Boolean).join(' '),cells:[
   {text:name,kind:'strong'},{text:c?.phone||'—'},{text:c?.email||'—'},{text:String(sale.count)},
   {text:money(sale.total),kind:'amount'},{text:money(paid),kind:'amount'},
   {text:money(balance),kind:'amount',tone:balance>0?'warning':'neutral'}
  ]};
 });
 const limited=links.length===250||orders.length===1000||payments.length===1000;
 const withOrders=links.filter(c=>(orderTotals.get(c.customer_id)?.count||0)>0).length;
 const withBalances=rows.filter(r=>r.filter==='Balance due').length;
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="SALES / CUSTOMERS" title="Customers" description="Customer contacts and related order balances for your current business workspace." action={{href:'/customers/new',label:'Add customer'}}/>
  <BusinessSummary items={[{label:'Customers in loaded list',value:links.length,detail:'Most recent 250 maximum'},{label:'With recorded orders',value:withOrders,detail:'Based on loaded transactions'},{label:'With outstanding balances',value:withBalances,detail:'Review individual orders for accuracy'}]}/>
  {limited&&<BusinessAlert>Some records have reached the loading limit. The displayed balances and counts may be incomplete. Use the financial reports for reconciled totals.</BusinessAlert>}
  <BusinessSection title="Customer directory" description="Search by name, phone or email. Select a row's customer details in an order when creating a sale.">
   <BusinessRecordsTable columns={['Customer','Phone','Email','Orders','Order value','Received','Balance']} rows={rows} searchLabel="Search customers by name, phone or email" emptyTitle="No customers added yet" emptyDescription="Add your first customer to begin recording orders and payments." emptyHref="/customers/new" emptyAction="Add customer" limitNote="Balances reflect loaded, non-cancelled orders and completed payments. A customer can have credits or historical transactions outside this loaded set."/>
  </BusinessSection>
 </div>;
}
