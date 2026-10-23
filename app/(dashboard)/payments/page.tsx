import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
import type {RecordItem} from '@/components/business-records';
import {parseDirectory,DIRECTORY_SIZE,type DirectoryRaw} from '@/lib/record-directory';
import {ServerRecordRegister} from '@/components/server-record-register';
export const dynamic='force-dynamic';
const filters=[{value:'completed',label:'Completed'},{value:'pending',label:'Pending'},{value:'failed',label:'Failed'},{value:'refunded',label:'Refunded'}];
export default async function Payments({searchParams}:{searchParams:Promise<DirectoryRaw>}){
 const {client,businessId}=await getWorkspace();
 const params=parseDirectory(await searchParams);
 const status=filters.some(f=>f.value===params.status)?params.status:'';
 let query=client.from('payments')
  .select('id,order_id,amount,method,status,reference,paid_at',{count:'exact'})
  .eq('business_id',businessId);
 if(params.q){
  const pattern='%'+params.q+'%';
  query=query.ilike('reference',pattern);
 }
 if(status)query=query.eq('status',status);
 const {data,error,count}=await query.order('paid_at',{ascending:false}).order('id',{ascending:false})
  .range(params.offset,params.offset+DIRECTORY_SIZE-1);
 if(error)return <div className="bo-page"><BusinessPageHeading eyebrow="FINANCE / PAYMENTS" title="Customer payments" description="Review recorded receipts."/><BusinessAlert>Payment history could not be loaded. Please retry before relying on the figures.</BusinessAlert></div>;
 const payments=data||[];
 const ids=Array.from(new Set(payments.map(p=>p.order_id).filter((v):v is string=>typeof v==='string'&&!!v)));
 const linked=ids.length?await client.from('orders').select('id,order_number').eq('business_id',businessId).in('id',ids):{data:[],error:null};
 const names=new Map((linked.data||[]).map(o=>[o.id,o.order_number]));
 const completed=payments.filter(p=>p.status==='completed');
 const received=completed.reduce((sum,p)=>sum+(Number(p.amount)||0),0);
 const rows:RecordItem[]=payments.map(p=>{
  const state=p.status==='completed'?'Completed':p.status||'Unknown';
  const date=p.paid_at?new Date(p.paid_at).toLocaleDateString('en-NG'):'Not dated';
  return {id:p.id,filter:state,search:[names.get(p.order_id),p.reference,p.method,state].filter(Boolean).join(' '),cells:[
   {text:date,kind:'muted'},
   {text:names.get(p.order_id)||'Open order',href:p.order_id?`/orders/${p.order_id}`:undefined,kind:'strong'},
   {text:money(Number(p.amount)||0),kind:'amount'},{text:p.method||'—'},
   {text:state,kind:'status',tone:state==='Completed'?'success':state==='failed'?'danger':'warning'},
   {text:p.reference||'—',kind:'muted'},
   p.status==='completed'?{text:'Print acknowledgement',href:`/payments/${p.id}`,kind:'strong'}:{text:'—',kind:'muted'}
  ]};
 });
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="FINANCE / PAYMENTS" title="Customer payments" description="Search all recorded payment references, including older entries. This register displays recorded payments, not bank settlement." action={{href:'/orders',label:'Find an order'}}/>
  <BusinessSummary items={[{label:status||params.q?'Matching payments':'Payment records',value:count??'—',detail:'Across your complete payment history'},{label:'Completed payments on this page',value:completed.length},{label:'Received on this page',value:money(received),detail:'Completed entries only'}]}/>
  {linked.error&&<BusinessAlert>Order numbers are temporarily unavailable. Payment entries and amounts shown remain from the selected business.</BusinessAlert>}
  <BusinessSection title="Payment history" description="Find a payment by reference and filter by recorded status.">
   <ServerRecordRegister route="/payments" columns={['Paid on','Order','Amount','Method','Status','Reference','Document']}
    rows={rows} count={count} page={params.page} pageSize={DIRECTORY_SIZE} q={params.q}
    status={status} filterOptions={filters} searchLabel="Search payment reference"
    emptyTitle="No payments recorded yet" emptyDescription="Record a payment from an existing customer order."
    emptyHref="/orders" emptyAction="View orders"
    note="Figures cover the current page only. A payment acknowledgement confirms a recorded entry, not bank settlement."/>
  </BusinessSection>
 </div>;
}
