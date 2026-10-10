import {getWorkspace} from '@/lib/server/workspace';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessSection,BusinessSummary,BusinessAlert} from '@/components/business-page-ui';
import {BusinessRecordsTable,type RecordItem} from '@/components/business-records';
export const dynamic='force-dynamic';
export default async function Products(){
 const {client,businessId}=await getWorkspace();
 const {data,error}=await client.from('products').select('id,name,sku,item_type,selling_price,cost_price,stock_quantity,minimum_stock,track_inventory,active').eq('business_id',businessId).order('created_at',{ascending:false}).limit(250);
 if(error)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / CATALOGUE" title="Products & services" description="Manage the items and services available to your business."/><BusinessAlert>The product catalogue could not be loaded. Please check workspace access and retry.</BusinessAlert></div>;
 const items=data||[];
 const low=items.filter(p=>p.active&&p.track_inventory&&Number(p.stock_quantity)<=Number(p.minimum_stock));
 const rows:RecordItem[]=items.map(p=>{
  const status=!p.active?'Inactive':p.track_inventory&&Number(p.stock_quantity)<=Number(p.minimum_stock)?'Low stock':'Active';
  return {id:p.id,search:[p.name,p.sku,p.item_type,status].filter(Boolean).join(' '),filter:status,cells:[
   {text:p.name,kind:'strong'},{text:p.sku||'—'},{text:p.item_type||'Product'},
   {text:money(Number(p.selling_price)||0),kind:'amount'},{text:money(Number(p.cost_price)||0),kind:'amount'},
   {text:p.track_inventory?String(Number(p.stock_quantity)):'Not tracked'},
   {text:status,kind:'status',tone:status==='Low stock'?'warning':status==='Inactive'?'neutral':'success'}
  ]};
 });
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="OPERATIONS / CATALOGUE" title="Products & services" description="Keep selling prices, item codes and inventory tracking together." action={{href:'/products/new',label:'Add item'}}/>
  <BusinessSummary items={[{label:'Items in loaded catalogue',value:items.length,detail:'Most recent 250 maximum'},{label:'Active items',value:items.filter(p=>p.active).length},{label:'Products needing stock review',value:low.length,warning:low.length>0}]}/>
  {items.length===250&&<BusinessAlert>Showing only the 250 most recently added items. This is not a complete catalogue or inventory valuation.</BusinessAlert>}
  <BusinessSection title="Catalogue" description="Search by item name or SKU and filter by availability.">
   <BusinessRecordsTable columns={['Item','SKU','Type','Selling price','Unit cost','On hand','Status']} rows={rows} searchLabel="Search products, services or SKU" emptyTitle="Your catalogue is empty" emptyDescription="Add a product or service to start building the catalogue." emptyHref="/products/new" emptyAction="Add item" limitNote="Low-stock status uses recorded on-hand quantity and minimum threshold. For count corrections, use the Inventory workspace."/>
  </BusinessSection>
 </div>;
}
