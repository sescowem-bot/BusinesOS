import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
import type {RecordItem} from '@/components/business-records';
import {parseDirectory,DIRECTORY_SIZE,type DirectoryRaw} from '@/lib/record-directory';
import {ServerRecordRegister} from '@/components/server-record-register';
export const dynamic='force-dynamic';
export default async function Products({searchParams}:{searchParams:Promise<DirectoryRaw>}){
 const {client,businessId,role}=await getWorkspace();
 const canEdit=['owner','manager','inventory'].includes(role);
 const params=parseDirectory(await searchParams);
 const status=['active','inactive'].includes(params.status)?params.status:'';
 let query=client.from('products')
  .select('id,name,sku,item_type,selling_price,cost_price,stock_quantity,minimum_stock,track_inventory,active',{count:'exact'})
  .eq('business_id',businessId);
 if(params.q){
  const pattern='%'+params.q+'%';
  query=query.or(`name.ilike."${pattern}",sku.ilike."${pattern}"`);
 }
 if(status)query=query.eq('active',status==='active');
 const {data,error,count}=await query.order('created_at',{ascending:false}).order('id',{ascending:false})
  .range(params.offset,params.offset+DIRECTORY_SIZE-1);
 if(error)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / CATALOGUE" title="Products & services" description="Find products, services and prices."/><BusinessAlert>The catalogue could not be loaded. Your records have not changed.</BusinessAlert></div>;
 const items=data||[];
 const low=items.filter(p=>p.active&&p.track_inventory&&Number(p.stock_quantity)<=Number(p.minimum_stock));
 const rows:RecordItem[]=items.map(p=>{
  const state=!p.active?'Inactive':p.track_inventory&&Number(p.stock_quantity)<=Number(p.minimum_stock)?'Low stock':'Active';
  return {id:p.id,search:[p.name,p.sku,p.item_type,state].filter(Boolean).join(' '),filter:state,cells:[
   {text:p.name,kind:'strong'},{text:p.sku||'—'},{text:p.item_type||'Product'},
   {text:money(Number(p.selling_price)||0),kind:'amount'},
   {text:money(Number(p.cost_price)||0),kind:'amount'},
   {text:p.track_inventory?String(Number(p.stock_quantity)):'Not tracked'},
   {text:state,kind:'status',tone:state==='Low stock'?'warning':state==='Inactive'?'neutral':'success'}
  ]};
 });
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="OPERATIONS / CATALOGUE" title="Products & services" description="Search all items by name or SKU. Review inventory and prices without loading the full catalogue." action={canEdit?{href:'/products/new',label:'Add item'}:undefined}/>
  <BusinessSummary items={[{label:status||params.q?'Matching items':'Products & services',value:count??'—',detail:'Across your complete catalogue'},{label:'Items on this page',value:items.length},{label:'Low stock on this page',value:low.length,warning:low.length>0}]}/>
  <BusinessSection title="Catalogue" description="Filter active or inactive records; low-stock flags describe only the items shown on this page.">
   <ServerRecordRegister route="/products" columns={['Item','SKU','Type','Selling price','Unit cost','On hand','Status']}
    rows={rows} count={count} page={params.page} pageSize={DIRECTORY_SIZE} q={params.q}
    status={status} filterOptions={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]}
    searchLabel="Product name or SKU" emptyTitle="Your catalogue is empty" emptyDescription="Add a product or service to get started."
    emptyHref={canEdit?'/products/new':undefined} emptyAction={canEdit?'Add item':undefined}
    note="Stock warnings use on-hand quantities and minimum thresholds. For adjustments, open Inventory."/>
  </BusinessSection>
 </div>;
}
