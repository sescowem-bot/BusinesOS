import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {money} from '@/lib/format';
import {BusinessPageHeading} from '@/components/business-page-ui';
import {AdjustmentForm,StockCountForm} from '../catalog/forms';
export const dynamic='force-dynamic';

type Product={id:string;name:string;sku:string|null;stock_quantity:number|string;minimum_stock:number|string;cost_price:number|string;track_inventory:boolean;active:boolean};
type Movement={id:string;product_id:string;movement_type:string;quantity:number|string;notes:string|null;created_at:string};
type Count={id:string;product_id:string;expected_quantity:number|string;counted_quantity:number|string;variance:number|string;reason:string;counted_at:string};
export default async function InventoryPage(){
 const access=await requireBusinessFeature('inventory');
 if(!access.allowed)return <section className="tax-page"><h1>Inventory access restricted</h1><p role="alert">{access.reason}</p><Link href="/upgrade" className="btn">View subscription plans</Link></section>;
 const {client,businessId,role}=access;
 const [stockResult,movementResult,countResult]=await Promise.all([
  client.from('products').select('id,name,sku,stock_quantity,minimum_stock,cost_price,track_inventory,active').eq('business_id',businessId).eq('track_inventory',true).eq('active',true).order('name').limit(500),
  client.from('inventory_movements').select('id,product_id,movement_type,quantity,notes,created_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(50),
  client.from('inventory_stock_counts').select('id,product_id,expected_quantity,counted_quantity,variance,reason,counted_at').eq('business_id',businessId).order('counted_at',{ascending:false}).limit(30)
 ]);
 const missing=stockResult.error||movementResult.error;
 if(missing)return <section className="tax-page"><h1>Inventory</h1><p role="alert">Inventory records could not be loaded. Check your permissions and migration 007.</p></section>;
 const items=(stockResult.data||[]) as Product[],movements=(movementResult.data||[]) as Movement[],counts=(countResult.data||[]) as Count[];
 const canManage=['owner','manager','inventory'].includes(role);
 const stockValue=items.reduce((total,p)=>total+Number(p.stock_quantity)*Number(p.cost_price),0);
 const low=items.filter(p=>Number(p.stock_quantity)<=Number(p.minimum_stock));
 const nameFor=(id:string)=>items.find(p=>p.id===id)?.name||'Archived or inactive product';
 return <div className="tax-page">
  <BusinessPageHeading eyebrow="OPERATIONS / INVENTORY" title="Inventory & stock counts" description="Review on-hand quantities, count variances and stock movements. Physical counts do not automatically post accounting journals."/>
  <p><Link href="/inventory/locations" className="btn btn-primary">Manage branch stock, transfers & counts</Link></p>
  <div className="grid grid-3">
   <section className="tax-panel"><p className="small muted">Tracked products (up to 500)</p><h2>{items.length}</h2></section>
   <section className="tax-panel"><p className="small muted">Value of displayed stock at cost</p><h2>{money(stockValue)}</h2></section>
   <section className="tax-panel"><p className="small muted">At or below minimum</p><h2>{low.length}</h2></section>
  </div>
  {low.length>0&&<section className="tax-notice" role="status"><strong>Restocking attention needed</strong><p>{low.slice(0,5).map(p=>p.name).join(', ')}{low.length>5?` and ${low.length-5} more`:''}. Review quantities before ordering.</p></section>}
  <section className="tax-panel"><h2>Stock on hand</h2><div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>SKU</th><th>On hand</th><th>Minimum</th><th>Value at cost</th><th>Condition</th></tr></thead><tbody>
   {items.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku||'—'}</td><td>{Number(p.stock_quantity)}</td><td>{Number(p.minimum_stock)}</td><td>{money(Number(p.stock_quantity)*Number(p.cost_price))}</td><td>{Number(p.stock_quantity)<=Number(p.minimum_stock)?'Restock':'Healthy'}</td></tr>)}
   </tbody></table></div>{!items.length&&<p className="muted">No tracked items yet. <Link href="/products/new">Create a product</Link>.</p>}{items.length===500&&<p className="small muted">Showing first 500 products. Figures here are not a complete inventory valuation.</p>}</section>
  <section className="tax-panel"><h2>Restock planning</h2><p className="small muted">Suggestions use existing minimum stock thresholds only. They do not create purchase orders or forecast future demand.</p>
   {low.length?<div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Current stock</th><th>Minimum</th><th>Quantity to minimum</th></tr></thead><tbody>{low.map(p=><tr key={p.id}><td>{p.name}</td><td>{Number(p.stock_quantity)}</td><td>{Number(p.minimum_stock)}</td><td>{Math.max(0,Number(p.minimum_stock)-Number(p.stock_quantity)).toFixed(3)}</td></tr>)}</tbody></table></div>:<p className="muted">No tracked products are at or below their configured minimums in the loaded list.</p>}
   <p className="small muted"><Link href="/purchasing">Open purchasing</Link> to create a supplier draft. Actual goods receipts update company-wide stock, not individual branch quantities.</p>
  </section>
  <p className="small muted">This page counts the company-wide quantity. If any units are allocated to a branch, use location-specific stock counts instead; the database will reject legacy whole-company counts for distributed stock.</p>
  {canManage&&<div className="grid grid-2"><section className="tax-panel"><h2>Record physical stock count</h2><StockCountForm items={items.map(p=>({id:p.id,name:p.name,stock:Number(p.stock_quantity)}))}/></section>
   <section className="tax-panel"><h2>Manual stock adjustment</h2><p className="small muted">Use for known losses, returns or corrections. Counts should use the physical stock-count form instead.</p><AdjustmentForm items={items.map(p=>({id:p.id,name:p.name}))}/></section></div>}
  {!canManage&&<p className="small muted">You have inventory viewing access. Only an owner, manager or inventory-role member may change stock.</p>}
  <section className="tax-panel"><h2>Stock-count audit</h2>
   {countResult.error?<p role="alert">Count history is unavailable. Apply migration 027 before using physical counts.</p>:<div className="table-wrap"><table className="table"><thead><tr><th>Counted</th><th>Product</th><th>Recorded</th><th>Physical</th><th>Variance</th><th>Reason</th></tr></thead><tbody>{counts.map(c=><tr key={c.id}><td>{new Date(c.counted_at).toLocaleDateString('en-NG')}</td><td>{nameFor(c.product_id)}</td><td>{Number(c.expected_quantity)}</td><td>{Number(c.counted_quantity)}</td><td>{Number(c.variance)}</td><td>{c.reason}</td></tr>)}</tbody></table></div>}
   {!countResult.error&&!counts.length&&<p className="muted">No physical counts recorded yet.</p>}
  </section>
  <section className="tax-panel"><h2>Latest stock movements</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Product</th><th>Movement</th><th>Quantity change</th><th>Reason</th></tr></thead><tbody>{movements.map(m=><tr key={m.id}><td>{new Date(m.created_at).toLocaleDateString('en-NG')}</td><td>{nameFor(m.product_id)}</td><td>{m.movement_type}</td><td>{Number(m.quantity)}</td><td>{m.notes||'—'}</td></tr>)}</tbody></table></div>{!movements.length&&<p className="muted">No stock movements recorded.</p>}</section>
  <p className="small muted">Review unit costs and physical valuation with your finance team before using inventory figures for financial statements. Order-related stock deductions are not yet automated.</p>
 </div>;
}
