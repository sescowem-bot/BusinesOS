import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {customerNameFromRelation} from '@/lib/customer-relations';
import {BusinessPageHeading,BusinessAlert,BusinessSummary,BusinessSection} from '@/components/business-page-ui';
import {CheckoutForm} from './checkout-form';
import {money} from '@/lib/format';
export const dynamic='force-dynamic';
export default async function POSPage(){
 const access=await requireBusinessFeature('pos');
 if(!access.allowed)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / POS" title="Retail checkout" description="Software POS is an optional subscription feature."/><BusinessAlert>{access.reason} <Link href="/upgrade">View available plans</Link>.</BusinessAlert></div>;
 const {client,businessId,role,userId}=access;
 const [locationsResult,balancesResult,assignmentResultBranch,heldResult]=await Promise.all([
  client.from('business_stock_locations').select('id,name,branch_id,is_unallocated,active').eq('business_id',businessId).eq('active',true).order('name').limit(50),
  client.from('business_location_balances').select('location_id,product_id,quantity').eq('business_id',businessId).limit(7000),
  role==='sales'?client.from('business_branch_members').select('branch_id').eq('business_id',businessId).eq('user_id',userId):Promise.resolve({data:[],error:null}),
  client.from('business_pos_held_carts').select('id,label,location_id,customer_id,basket,price_mode,discount,updated_at').eq('business_id',businessId).eq('cashier_id',userId).order('updated_at',{ascending:false}).limit(20)
 ]);
 const locationUnavailable=Boolean(locationsResult.error||balancesResult.error||assignmentResultBranch.error||
  locationsResult.data?.length===50||balancesResult.data?.length===7000);
 const assigned=new Set((assignmentResultBranch.data||[]).map(x=>x.branch_id));
 const locations=(locationsResult.data||[]).filter(l=>role!=='sales'||l.is_unallocated||l.branch_id&&assigned.has(l.branch_id))
  .map(l=>({id:l.id,name:l.name,is_unallocated:l.is_unallocated}));
 const locationStocks:Record<string,Record<string,number>>={};
 for(const b of balancesResult.data||[]){(locationStocks[b.location_id]??={})[b.product_id]=Number(b.quantity);}

 const [productResult,customerResult,saleResult,profileResult,mappingResult,assignmentResult]=await Promise.all([
  client.from('products').select('id,name,sku,selling_price,stock_quantity,track_inventory').eq('business_id',businessId).eq('active',true).order('name').limit(500),
  client.from('business_customers').select('customer_id,customers(name)').eq('business_id',businessId).limit(500),
  client.from('business_pos_sales').select('id,order_id,created_at,order:orders(order_number,total,status)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(30),
  client.from('business_tax_profiles').select('vat_registration_status,classification_status').eq('business_id',businessId).maybeSingle(),
  client.from('business_product_tax_mappings').select('product_id,supply_id').eq('business_id',businessId).limit(500),
  client.from('business_tax_assignments').select('supply_id,status,tax_rule_versions(status,tax_kind,treatment,rate_basis_points,effective_from,effective_to)').eq('business_id',businessId).eq('status','approved').limit(1000)
 ]);
 const vatRegistered=profileResult.data?.vat_registration_status==='registered';
 const reviewed=vatRegistered&&profileResult.data?.classification_status==='reviewed';
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const approved=new Map<string,Array<{treatment:string;rate_basis_points:number}>>();
 for(const a of assignmentResult.data||[]){const t=Array.isArray(a.tax_rule_versions)?a.tax_rule_versions[0]:a.tax_rule_versions;
  if(!t||t.status!=='approved'||t.tax_kind!=='vat'||t.effective_from>today||t.effective_to&&t.effective_to<today)continue;
  if(!((t.treatment==='standard'&&t.rate_basis_points===750)||(['zero_rated','exempt','outside_scope'].includes(t.treatment)&&t.rate_basis_points===0)))continue;
  approved.set(a.supply_id,[...(approved.get(a.supply_id)||[]),{treatment:t.treatment,rate_basis_points:t.rate_basis_points}]);
 }
 const productMapping=new Map((mappingResult.data||[]).map(m=>[m.product_id,m.supply_id]));
 const productTax=Object.fromEntries((productResult.data||[]).map(p=>{const supply=productMapping.get(p.id);const rule=supply?approved.get(supply):undefined;
  return [p.id,rule?.length===1?{ready:true,treatment:rule[0].treatment,rate:rule[0].rate_basis_points}:{ready:false,treatment:'needs_review',rate:0}];}));
 const taxDataUnavailable=Boolean(profileResult.error||(vatRegistered&&(mappingResult.error||assignmentResult.error)));
 const taxBlocked=taxDataUnavailable||(vatRegistered&&!reviewed)||locationUnavailable||!locations.length||!!heldResult.error;
 return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / RETAIL" title="Software Point of Sale" description="Record counter sales from a phone, tablet or computer. No physical terminal or gateway is required." action={{href:'/pos/tax-mapping',label:'Product tax setup'}}/>
 <BusinessSummary items={[{label:'Products loaded',value:productResult.data?.length??0,detail:'Up to 500 active items'},{label:'Recent POS sales',value:saleResult.data?.length??0,detail:'Last 30 maximum'}]}/>
 {(productResult.error||customerResult.error||saleResult.error||taxDataUnavailable)&&<BusinessAlert>Checkout data or tax classifications are unavailable. Confirm migrations 031–033 and workspace permissions; do not start a sale until the data loads.</BusinessAlert>}
 {locationUnavailable&&<BusinessAlert>Branch stock records are unavailable or the stock ledger exceeds the current page limit. Verify migration 039 and do not proceed with checkout until records are complete.</BusinessAlert>}
 {heldResult.error&&<BusinessAlert>Held carts cannot be loaded. Apply SQL 040 after 039 before processing premium checkout.</BusinessAlert>}
 {!locationUnavailable&&!locations.length&&<BusinessAlert>No authorised stock location is available. Contact the business owner to enable a branch or assign your cashier access.</BusinessAlert>}
 {vatRegistered&&<BusinessAlert>{reviewed?'This VAT-registered business uses approved item-level VAT rules for all POS items. Choose VAT-exclusive or VAT-inclusive catalogue pricing at checkout; tax rules must be reviewed before sale.':'POS is blocked until this VAT-registered business has a reviewed tax profile. Open Tax Centre.'} <Link href="/pos/tax-mapping">Manage product classifications</Link>.</BusinessAlert>}
 {!productResult.error&&!customerResult.error&&!saleResult.error&&!taxBlocked&&(['owner','manager','sales'].includes(role)?<CheckoutForm products={(productResult.data||[]).map(p=>({...p,selling_price:Number(p.selling_price),stock_quantity:Number(p.stock_quantity)}))} customers={(customerResult.data||[]).map(x=>({id:x.customer_id,name:customerNameFromRelation(x.customers)}))} taxMode={reviewed?'reviewed':'unverified'} productTax={productTax} locations={locations} locationStocks={locationStocks} heldCarts={(heldResult.data||[]).map(c=>({...c,discount:Number(c.discount)}))}/>:<BusinessAlert>Your role may view POS records but cannot complete checkout.</BusinessAlert>)}
 {productResult.data?.length===500&&<BusinessAlert>Only 500 active catalogue items were loaded. Narrow the catalogue before relying on this POS for larger businesses.</BusinessAlert>}
 <p className="bo-back-link"><Link href="/wholesale">Wholesale reference prices →</Link></p>
 <p className="bo-back-link"><Link href="/inventory/locations">Branch stock & location transfers →</Link></p>
 <p className="bo-back-link"><Link href="/pos/shifts">Open cashier shifts & till reconciliation →</Link></p>
 <p className="bo-back-link"><Link href="/returns">Open returns, refunds and credit notes →</Link></p>
 <BusinessSection title="Recent POS orders" description="Open an order to view its details and print the existing statement."><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Order</th><th>Recorded amount</th><th>State</th><th>Receipt</th></tr></thead><tbody>{(saleResult.data||[]).map(s=>{const relation:unknown=Array.isArray(s.order)?s.order[0]:s.order;const order=relation&&typeof relation==='object'&&'order_number' in relation?relation as {order_number:string;total:number;status:string}:null;return <tr key={s.id}><td>{new Date(s.created_at).toLocaleDateString('en-NG')}</td><td><Link href={`/pos/receipts/${s.order_id}`}>{order?.order_number||'View order'}</Link></td><td>{money(Number(order?.total||0))}</td><td>{order?.status||'—'}</td><td><Link href={`/pos/receipts/${s.order_id}`}>Print</Link></td></tr>})}</tbody></table></div>{!saleResult.data?.length&&<p className="small muted">No POS sales recorded yet.</p>}</BusinessSection>
 <p className="small muted">All payments recorded here are based on staff confirmation, not a settlement check. No payment processing, automatic external refunds, delivery tax assessments, or hardware integration is included. Approved external refunds may be recorded separately in Returns. Registered and reviewed businesses calculate approved VAT in the database; all other tax treatment requires independent review.</p>
 </div>;
}
