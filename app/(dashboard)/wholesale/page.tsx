import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {BusinessAlert,BusinessPageHeading,BusinessSummary,BusinessSection} from '@/components/business-page-ui';
import {PriceTierForm,DeleteTierForm} from './forms';
export const dynamic='force-dynamic';
const ngn=(n:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
export default async function WholesalePage(){
 const access=await requireBusinessFeature('pos');
 if(!access.allowed)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / WHOLESALE" title="Wholesale reference pricing" description="This pricing catalogue is available with the POS module."/><BusinessAlert>{access.reason}</BusinessAlert></div>;
 const {client,businessId,role}=access;const canManage=['owner','manager'].includes(role);
 const [productsResult,tiersResult]=await Promise.all([
 client.from('products').select('id,name,sku,selling_price').eq('business_id',businessId).eq('active',true).order('name').limit(200),
 client.from('business_wholesale_price_tiers').select('id,product_id,min_quantity,unit_price,note,updated_at').eq('business_id',businessId).order('updated_at',{ascending:false}).limit(200)
 ]);
 if(productsResult.error||tiersResult.error)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / WHOLESALE" title="Wholesale reference pricing" description="Controlled bulk-pricing catalogue"/><BusinessAlert>Wholesale pricing data cannot be verified. Confirm Migration 041 and your POS permissions. No pricing edits are available until it loads.</BusinessAlert></div>;
 const products=(productsResult.data||[]).map(p=>({...p,selling_price:Number(p.selling_price)}));
 const tiers=tiersResult.data||[];
 const productsById=new Map(products.map(p=>[p.id,p]));
 const truncated=products.length===200||tiers.length===200;
 return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / WHOLESALE" title="Wholesale reference pricing" description="Maintain controlled quantity discounts without slowing down retail POS or bypassing reviewed tax calculations." action={{href:'/pos',label:'Retail POS'}}/>
  <BusinessSummary items={[{label:'Catalogue products loaded',value:products.length,detail:'Limited to 200'},{label:'Active tiers loaded',value:tiers.length,detail:'Limited to 200'},{label:'Management access',value:canManage?'Editor':'Reference only'}]}/>
  <BusinessAlert><strong>Reference prices only.</strong> These tiers do not automatically change the final POS price, VAT calculation, invoice or payment. The cashier must continue using approved checkout pricing; automatic tax-reviewed wholesale fulfilment is a separate validation task.</BusinessAlert>
  {truncated&&<BusinessAlert>Pricing lists reached the 200-record display limit. Updates are disabled until pagination or targeted lookup is enabled. Existing tiers remain unchanged.</BusinessAlert>}
  {canManage&&!truncated&&<BusinessSection title="Create quantity-based price tier" description="Set a lower reference unit price, starting at a minimum of two items."><div className="bo-wholesale-form-wrap"><PriceTierForm products={products}/></div></BusinessSection>}
  <BusinessSection title="Current reference tiers" description="This table is intentionally limited for fast loading and is not a source of final customer charges.">
   <div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>From quantity</th><th>Reference unit price</th><th>Retail unit price</th><th>Note</th>{canManage&&!truncated&&<th>Manage</th>}</tr></thead><tbody>{tiers.map(t=><tr key={t.id}><td>{productsById.get(t.product_id)?.name||'Product not in current listing'}</td><td>{Number(t.min_quantity)}</td><td>{ngn(Number(t.unit_price))}</td><td>{productsById.has(t.product_id)?ngn(Number(productsById.get(t.product_id)?.selling_price||0)):'—'}</td><td>{t.note||'—'}</td>{canManage&&!truncated&&<td><DeleteTierForm tier={t.id}/></td>}</tr>)}</tbody></table></div>
   {!tiers.length&&<p className="muted">No wholesale price tiers have been entered.</p>}
  </BusinessSection>
  <p className="small muted">For financial reporting based on POS transactions, open <Link href="/retail-reports">Retail performance</Link>.</p>
 </div>;
}
