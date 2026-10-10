import {customerNameFromRelation} from '@/lib/customer-relations';
import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
import {BusinessRecordsTable,type RecordItem} from '@/components/business-records';
export const dynamic='force-dynamic';
type InvoiceSnapshot={customer?:{name?:string};total?:number};
export default async function Invoices(){
 const {client,businessId}=await getWorkspace();
 const [invoicesResult,ordersResult,linksResult]=await Promise.all([
  client.from('business_invoices').select('id,invoice_number,order_id,issued_at,snapshot').eq('business_id',businessId).order('issued_at',{ascending:false}).limit(100),
  client.from('orders').select('id,order_number,total,status,created_at,customer_id,payments(amount,status)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(100),
  client.from('business_customers').select('customer_id,customers(name)').eq('business_id',businessId).limit(500)
 ]);
 if(ordersResult.error||linksResult.error)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / DOCUMENTS" title="Invoices & statements" description="Keep issued commercial invoices and order statements organised."/><BusinessAlert>Order records could not be verified. Try again before issuing documents.</BusinessAlert></div>;
 const available=!invoicesResult.error,issued=invoicesResult.data||[],orders=ordersResult.data||[];
 const names=new Map<string,string>((linksResult.data||[]).map(v=>[v.customer_id,customerNameFromRelation(v.customers, 'Customer')]));
 const issuedOrderIds=new Set(issued.map(i=>i.order_id));
 const issuedRows:RecordItem[]=issued.map(i=>{
  const s=(i.snapshot||{}) as InvoiceSnapshot;
  const customer=s.customer?.name||'Walk-in';
  return {id:i.id,search:[i.invoice_number,customer].join(' '),filter:'Issued',cells:[
   {text:i.invoice_number,href:`/invoices/issued/${i.id}`,kind:'strong'},
   {text:customer},{text:money(Number(s.total)||0),kind:'amount'},
   {text:new Date(i.issued_at).toLocaleDateString('en-NG'),kind:'muted'},
   {text:'Issued',kind:'status',tone:'success'},
   {text:'View / print',href:`/invoices/issued/${i.id}`}
  ]};
 });
 let pending=0;
 const orderRows:RecordItem[]=orders.map(o=>{
  const paid=(o.payments||[]).filter(p=>p.status==='completed').reduce((sum,p)=>sum+(Number(p.amount)||0),0);
  const balance=Math.max(0,(Number(o.total)||0)-paid);
  const status=issuedOrderIds.has(o.id)?'Invoice issued':o.status==='cancelled'?'Cancelled':'Not issued';
  if(status==='Not issued')pending++;
  return {id:o.id,filter:status,search:[o.order_number,names.get(o.customer_id),status].filter(Boolean).join(' '),cells:[
   {text:o.order_number||'Order',href:`/orders/${o.id}`,kind:'strong'},
   {text:names.get(o.customer_id)||'Walk-in'},
   {text:money(Number(o.total)||0),kind:'amount'},{text:money(balance),kind:'amount'},
   {text:available?status:'Unavailable',kind:'status',tone:status==='Invoice issued'?'success':status==='Cancelled'?'danger':'warning'},
   {text:'Open order',href:`/orders/${o.id}`},{text:'Print statement',href:`/invoices/${o.id}`}
  ]};
 });
 return <div className="bo-page">
  <p className="small" style={{textAlign:"right"}}><Link href="/settings/invoice">Edit invoice identity and payment details →</Link></p>
  <BusinessPageHeading eyebrow="SALES / DOCUMENTS" title="Invoices & statements" description="Issue numbered commercial invoices from existing orders and print payment statements. These documents are not certified statutory tax invoices." action={{href:'/orders/new',label:'New order'}}/>
  <BusinessSummary items={[{label:'Issued invoices in loaded list',value:available?issued.length:'Unavailable',detail:'Latest 100 maximum'},{label:'Orders awaiting issuance',value:available?pending:'Unavailable',detail:'Within listed orders'},{label:'Orders in loaded list',value:orders.length,detail:'Latest 100 maximum'}]}/>
  {!available&&<BusinessAlert>Commercial invoice records are unavailable. Check Migration 022 and database permissions. Order statements can still be opened from the orders listed below.</BusinessAlert>}
  {(issued.length===100||orders.length===100)&&<BusinessAlert>The invoice or order list is capped at the newest 100 records. Counters are not complete-period financial totals.</BusinessAlert>}
  {available&&<BusinessSection title="Issued commercial invoices" description="These numbered documents retain the amounts and customer details captured when issued.">
   <BusinessRecordsTable columns={['Invoice','Customer','Total at issue','Issued','Status','Document']} rows={issuedRows} searchLabel="Search invoice number or customer" emptyTitle="No invoices issued yet" emptyDescription="Open an existing order to issue its first commercial invoice." emptyHref="/orders" emptyAction="Open orders" limitNote="Amounts shown here are issuance snapshots; later payments do not change the original invoice total."/>
  </BusinessSection>}
  <BusinessSection title="Orders & payment statements" description="Open an order to issue an invoice, or print its current statement.">
   <BusinessRecordsTable columns={['Order','Customer','Order value','Balance','Invoice state','Order action','Statement']} rows={orderRows} searchLabel="Search orders or customers" emptyTitle="No orders available" emptyDescription="Create a customer order to start issuing documents." emptyHref="/orders/new" emptyAction="Create order" limitNote="Payment statements reflect the current payments recorded against an order. Commercial invoice documents preserve the original issuance values."/>
  </BusinessSection>
 </div>;
}
