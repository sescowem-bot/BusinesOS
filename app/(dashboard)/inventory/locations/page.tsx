import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {BusinessPageHeading,BusinessAlert,BusinessSummary,BusinessSection} from '@/components/business-page-ui';
import {EnableBranchForm,BranchTransferForm,BranchStockCountForm} from './forms';
export const dynamic='force-dynamic';
export default async function BranchInventoryPage(){
 const a=await requireBusinessFeature('inventory');
 if(!a.allowed)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / INVENTORY" title="Branch stock" description="Location-level inventory requires an enabled plan."/><BusinessAlert>{a.reason} <Link href="/upgrade">View plans</Link></BusinessAlert></div>;
 const {client,businessId,role}=a;
 const [locationsResult,productsResult,branchesResult,balancesResult,transfersResult,countsResult]=await Promise.all([
  client.from('business_stock_locations').select('id,name,branch_id,is_unallocated').eq('business_id',businessId).eq('active',true).order('name').limit(50),
  client.from('products').select('id,name,sku,stock_quantity').eq('business_id',businessId).eq('track_inventory',true).eq('active',true).order('name').limit(300),
  client.from('business_branches').select('id,name,active').eq('business_id',businessId).eq('active',true).order('name').limit(100),
  client.from('business_location_balances').select('location_id,product_id,quantity').eq('business_id',businessId).limit(7000),
  client.from('business_location_stock_transfers').select('id,product_id,from_location_id,to_location_id,quantity,reason,transferred_at').eq('business_id',businessId).order('transferred_at',{ascending:false}).limit(25),
  client.from('business_location_stock_counts').select('id,location_id,product_id,variance,reason,counted_at').eq('business_id',businessId).order('counted_at',{ascending:false}).limit(25)
 ]);
 const problem=locationsResult.error||productsResult.error||branchesResult.error||balancesResult.error;
 if(problem)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / INVENTORY" title="Branch stock & transfers" description="Physical stock by location"/><BusinessAlert>Cannot verify branch stock balances. Apply SQL 039 after SQL 038 in staging, then review your inventory permissions.</BusinessAlert></div>;
 const capped=locationsResult.data?.length===50||productsResult.data?.length===300||branchesResult.data?.length===100||balancesResult.data?.length===7000;
 const locations=locationsResult.data||[],products=productsResult.data||[],branches=branchesResult.data||[];
 const balances:Record<string,Record<string,number>>={};
 for(const b of balancesResult.data||[])(balances[b.location_id]??={})[b.product_id]=Number(b.quantity);
 const locationName=new Map(locations.map(l=>[l.id,l.name]));const productName=new Map(products.map(p=>[p.id,p.name]));
 const branchIds=new Set(locations.map(l=>l.branch_id));const canManage=role==='owner'||role==='manager';
 const mismatches=products.filter(p=>Math.abs(Number(p.stock_quantity)-locations.reduce((sum,l)=>sum+(balances[l.id]?.[p.id]||0),0))>0.0001);
 const summary=[{label:'Active stock locations',value:locations.length,detail:'Includes unallocated / receiving'},{label:'Tracked products shown',value:products.length,detail:'Latest 300 maximum'},{label:'Reconciliation exceptions',value:mismatches.length,detail:'Compare to company-wide stock'}];
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="OPERATIONS / INVENTORY" title="Branch stock & transfers" description="Control physical stock at individual locations while keeping the company-wide total reconciled." action={{href:'/inventory',label:'Company inventory'}}/>
  <BusinessSummary items={summary}/>
  <BusinessAlert>Existing stock is initially marked <strong>Unallocated / receiving</strong>. It is not assigned to a branch automatically. Goods receipts and external refunds enter Unallocated unless later transferred. POS checkout can use explicitly selected locations. Do not treat this page as a complete financial valuation.</BusinessAlert>
  {capped&&<BusinessAlert>Data limits reached (50 locations / 300 products / 7,000 balances). Location totals may be incomplete; management operations are disabled until data loading is expanded.</BusinessAlert>}
  {!!mismatches.length&&<BusinessAlert>Stock ledger mismatch detected for {mismatches.length} displayed products. Do not transfer or count stock until database reconciliation is reviewed.</BusinessAlert>}
  {canManage&&!capped&&!mismatches.length&&<div className="grid grid-2">
   <section className="card card-pad"><h2>Enable an existing branch location</h2><p className="small muted">First create the branch in Team & Branches. Activation does not move any stock.</p><EnableBranchForm branches={branches.filter(b=>!branchIds.has(b.id))}/></section>
   <section className="card card-pad"><h2>Transfer stock between locations</h2><p className="small muted">Transfers move available quantities only. The company-wide total does not change.</p><BranchTransferForm locations={locations} products={products}/></section>
  </div>}
  {!capped&&!mismatches.length&&['owner','manager','inventory'].includes(role)&&<BusinessSection title="Physical count at a location" description="Optimistic concurrency prevents saving a stale count. Differences update both the chosen location and the total stock atomically."><BranchStockCountForm locations={locations} products={products} balances={balances}/></BusinessSection>}
  <BusinessSection title="Current on-hand by location" description="Each location balance reconciles to the product's company-wide quantity.">
   <div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>SKU</th><th>Company total</th>{locations.map(l=><th key={l.id}>{l.name}</th>)}</tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku||'—'}</td><td>{Number(p.stock_quantity)}</td>{locations.map(l=><td key={l.id}>{balances[l.id]?.[p.id]||0}</td>)}</tr>)}</tbody></table></div>
   {!products.length&&<p className="muted">No tracked products are currently registered.</p>}
  </BusinessSection>
  <BusinessSection title="Recent transfers" description="Only recorded transfers are shown; transfers do not create extra stock.">
   {transfersResult.error?<BusinessAlert>Transfer history is unavailable.</BusinessAlert>:<div className="table-wrap"><table className="table"><thead><tr><th>When</th><th>Product</th><th>From</th><th>To</th><th>Quantity</th><th>Reason</th></tr></thead><tbody>{(transfersResult.data||[]).map(t=><tr key={t.id}><td>{new Date(t.transferred_at).toLocaleString('en-NG')}</td><td>{productName.get(t.product_id)||'Product'}</td><td>{locationName.get(t.from_location_id)||'Location'}</td><td>{locationName.get(t.to_location_id)||'Location'}</td><td>{Number(t.quantity)}</td><td>{t.reason}</td></tr>)}</tbody></table></div>}
  </BusinessSection>
  <BusinessSection title="Location count audit" description="Count adjustments are traceable and never overwrite the original count evidence.">
   {countsResult.error?<BusinessAlert>Count history is unavailable.</BusinessAlert>:<div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Location</th><th>Product</th><th>Variance</th><th>Reason</th></tr></thead><tbody>{(countsResult.data||[]).map(c=><tr key={c.id}><td>{new Date(c.counted_at).toLocaleString('en-NG')}</td><td>{locationName.get(c.location_id)||'Location'}</td><td>{productName.get(c.product_id)||'Product'}</td><td>{Number(c.variance)}</td><td>{c.reason}</td></tr>)}</tbody></table></div>}
  </BusinessSection>
 </div>;
}
