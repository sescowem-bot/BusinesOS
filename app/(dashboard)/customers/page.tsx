import {getWorkspace} from '@/lib/server/workspace';
import {coreActionAllowed} from '@/lib/server/core-action-permissions';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
import type {RecordItem} from '@/components/business-records';
import {parseDirectory,DIRECTORY_SIZE,type DirectoryRaw} from '@/lib/record-directory';
import {ServerRecordRegister} from '@/components/server-record-register';
export const dynamic='force-dynamic';
type CustomerLink={customer_id:string;customers:{name?:string;phone?:string|null;email?:string|null}|{name?:string;phone?:string|null;email?:string|null}[]|null};
export default async function Customers({searchParams}:{searchParams:Promise<DirectoryRaw>}){
 const access=await getWorkspace();const {client,businessId,role}=access;
 const canCreate=['owner','manager','finance','sales'].includes(role)&&await coreActionAllowed(access,'customers','create');
 const params=parseDirectory(await searchParams);
 let query=client.from('business_customers')
  .select('customer_id,customers!inner(name,phone,email)',{count:'exact'})
  .eq('business_id',businessId);
 if(params.q){
  const pattern='%'+params.q+'%';
  query=query.or(`name.ilike."${pattern}",phone.ilike."${pattern}",email.ilike."${pattern}"`,{referencedTable:'customers'});
 }
 const {data,error,count}=await query.order('created_at',{ascending:false}).order('customer_id',{ascending:false})
  .range(params.offset,params.offset+DIRECTORY_SIZE-1);
 if(error)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / CUSTOMERS" title="Customers" description="Find contacts across your complete customer history."/><BusinessAlert>Customer records could not be loaded. Please try again; no data has been changed.</BusinessAlert></div>;
 const links=(data||[]) as CustomerLink[];
 const rows:RecordItem[]=links.map(link=>{
  const c=Array.isArray(link.customers)?link.customers[0]:link.customers;
  const name=c?.name||'Unnamed customer';
  return {id:link.customer_id,search:[name,c?.phone,c?.email].filter(Boolean).join(' '),cells:[
   {text:name,kind:'strong'},{text:c?.phone||'—'},{text:c?.email||'—'},
   {text:'View orders',href:`/orders?customer=${encodeURIComponent(link.customer_id)}`,kind:'strong'},
   canCreate?{text:'Create order',href:`/orders/new?customer=${encodeURIComponent(link.customer_id)}`,kind:'strong'}:{text:'View only',kind:'muted'}
  ]};
 });
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="SALES / CUSTOMERS" title="Customers" description="Find customers by name, phone or email, including older records." action={canCreate?{href:'/customers/new',label:'Add customer'}:undefined}/>
  <BusinessSummary items={[{label:params.q?'Matching customers':'Customer records',value:count??'—',detail:'Search includes older records'},{label:'Showing on this page',value:rows.length,detail:`Page ${params.page} of your directory`}]}/>
  <BusinessSection title="Customer directory" description="Search the complete customer list or open a customer's orders. Balances belong to verified orders, not an incomplete customer sample.">
   <ServerRecordRegister route="/customers" columns={['Customer','Phone','Email','Orders','Next step']}
    rows={rows} count={count} page={params.page} pageSize={DIRECTORY_SIZE} q={params.q}
    searchLabel="Customer name, phone or email" emptyTitle="No customers added yet"
    emptyDescription="Add a customer to begin recording their orders and payments."
    emptyHref={canCreate?'/customers/new':undefined} emptyAction={canCreate?'Add customer':undefined}
    note="Customer balances are not estimated from a restricted sample of transactions. Open an order to see its recorded payments and balance."/>
  </BusinessSection>
 </div>;
}
