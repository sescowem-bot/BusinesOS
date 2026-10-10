import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {money} from '@/lib/format';
import {BusinessPageHeading,BusinessAlert,BusinessSection,BusinessSummary} from '@/components/business-page-ui';
import {SupplierForm,PurchaseForm,PartialReceiptForm,SupplierBillForm,SupplierPaymentForm} from './purchase-form';
export const dynamic='force-dynamic';

type PurchaseLine={id:string;purchase_id:string;product_id:string;quantity:number|string;received_quantity:number|string;unit_cost:number|string};
type SupplierBill={id:string;purchase_id:string;supplier_id:string;supplier_invoice_number:string;invoice_amount:number|string;due_on:string|null};
export default async function PurchasingPage(){
 const access=await requireBusinessFeature('purchasing');
 if(!access.allowed)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / PROCUREMENT" title="Suppliers & purchasing" description="An optional business operations module."/><BusinessAlert>{access.reason} <Link href="/upgrade">View plans</Link>.</BusinessAlert></div>;
 const {client,businessId,role}=access;
 const canWrite=['owner','manager','inventory'].includes(role);
 const canApproveBills=['owner','manager'].includes(role);
 const stock=await requireBusinessFeature('inventory');
 const canReceive=canWrite&&stock.allowed;
 const [supResult,prodResult,poResult]=await Promise.all([
  client.from('business_suppliers').select('id,name,contact_name,phone,email,active').eq('business_id',businessId).order('name').limit(200),
  client.from('products').select('id,name,cost_price,stock_quantity,minimum_stock').eq('business_id',businessId).eq('active',true).eq('track_inventory',true).order('name').limit(500),
  client.from('business_purchase_orders').select('id,reference,supplier_id,status,created_at,received_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(100)
 ]);
 if(supResult.error||prodResult.error||poResult.error)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / PROCUREMENT" title="Suppliers & purchasing" description="Supplier records and goods receiving"/><BusinessAlert>Procurement records could not be loaded. Verify migrations through 038 and access permissions.</BusinessAlert></div>;
 const suppliers=supResult.data||[],products=prodResult.data||[],orders=poResult.data||[];
 const poIds=orders.map(o=>o.id);
 const [itemsResult,billsResult]=await Promise.all([
  poIds.length?client.from('business_purchase_items').select('id,purchase_id,product_id,quantity,received_quantity,unit_cost').in('purchase_id',poIds).limit(2000):Promise.resolve({data:[] as PurchaseLine[],error:null}),
  canApproveBills?client.from('business_supplier_bills').select('id,purchase_id,supplier_id,supplier_invoice_number,invoice_amount,due_on').eq('business_id',businessId).order('created_at',{ascending:false}).limit(200):Promise.resolve({data:[] as SupplierBill[],error:null})
 ]);
 if(itemsResult.error)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / PROCUREMENT" title="Suppliers & purchasing" description="Purchase order records"/><BusinessAlert>Purchase lines could not be read. Confirm SQL migration 038 before using goods receiving.</BusinessAlert></div>;
 const bills=(billsResult.data||[]) as SupplierBill[];
 const billIds=bills.map(b=>b.id);
 const paymentsResult=canApproveBills&&billIds.length&&!billsResult.error?
  await client.from('business_supplier_bill_payments').select('id,bill_id,amount').in('bill_id',billIds).limit(2500):{data:[],error:null};
 const names=new Map(suppliers.map(s=>[s.id,s.name]));
 const productNames=new Map(products.map(p=>[p.id,p.name]));
 const lines=(itemsResult.data||[]) as PurchaseLine[];
 const paidByBill=new Map<string,number>();
 for(const payment of paymentsResult.data||[])paidByBill.set(payment.bill_id,(paidByBill.get(payment.bill_id)||0)+Number(payment.amount));
 const valueFor=(id:string)=>lines.filter(l=>l.purchase_id===id).reduce((sum,l)=>sum+Number(l.unit_cost)*Number(l.quantity),0);
 const receivedValueFor=(id:string)=>lines.filter(l=>l.purchase_id===id).reduce((sum,l)=>sum+Number(l.unit_cost)*Number(l.received_quantity),0);
 const listIsCapped=suppliers.length===200||products.length===500||orders.length===100||lines.length===2000||(canApproveBills&&bills.length===200)||((paymentsResult.data?.length||0)===2500);
 const supplierOutstanding=bills.reduce((n,b)=>n+Math.max(0,Number(b.invoice_amount)-(paidByBill.get(b.id)||0)),0);
 const financialDataReady=canApproveBills&&!billsResult.error&&!paymentsResult.error;
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="OPERATIONS / PROCUREMENT" title="Suppliers & purchasing" description="Manage supplier relationships, partial deliveries, goods receipts and externally verified supplier bills." action={{href:'/inventory',label:'Inventory'}}/>
  <BusinessSummary items={[{label:'Suppliers loaded',value:suppliers.length,detail:'Latest 200 maximum'},{label:'Open/partial orders',value:orders.filter(o=>o.status!=='received').length,detail:'Within latest 100 orders'},{label:'Received orders',value:orders.filter(o=>o.status==='received').length,detail:'Within latest 100 orders'},{label:'Recorded supplier bill balance',value:financialDataReady?money(supplierOutstanding):'Not available',detail:'Only recorded supplier bills; not full accounts payable'}]}/>
  {listIsCapped&&<BusinessAlert>One or more lists are capped. The totals on this page represent loaded records only, not company-wide financial totals.</BusinessAlert>}
  {!canReceive&&<BusinessAlert>Goods receiving requires both Purchasing and Inventory access, plus an authorised business role.</BusinessAlert>}
  <div className="grid grid-2">
   {canWrite&&<section className="card card-pad"><h2>Register supplier</h2><SupplierForm/></section>}
   {canWrite&&<section className="card card-pad"><h2>Create purchase order</h2><PurchaseForm suppliers={suppliers.filter(s=>s.active).map(s=>({id:s.id,name:s.name}))} products={products.map(p=>({id:p.id,name:p.name,cost_price:Number(p.cost_price)}))}/></section>}
  </div>
  <BusinessSection title="Purchase orders & partial deliveries" description="Receive only the goods physically delivered. Each confirmed receipt updates stock once; outstanding quantities remain open for later deliveries.">
   <div className="table-wrap"><table className="table"><thead><tr><th>Reference</th><th>Supplier</th><th>Ordered</th><th>Received at cost</th><th>Status</th><th>Delivery / receipt</th></tr></thead><tbody>{orders.map(o=>{
    const poLines=lines.filter(i=>i.purchase_id===o.id);
    const receiptLines=poLines.map(i=>({id:i.id,product_name:productNames.get(i.product_id)||'Inactive product',ordered:Number(i.quantity),received:Number(i.received_quantity),remaining:Number((Number(i.quantity)-Number(i.received_quantity)).toFixed(3))}));
    return <tr key={o.id}><td><strong>{o.reference}</strong><div className="small muted">{new Date(o.created_at).toLocaleDateString('en-NG')}</div></td><td>{names.get(o.supplier_id)||'Supplier'}</td><td>{money(valueFor(o.id))}</td><td>{money(receivedValueFor(o.id))}</td><td><span className="badge">{o.status==='partially_received'?'Part received':o.status==='received'?'Fully received':'Awaiting delivery'}</span></td><td><details><summary>View lines / receive goods</summary>{poLines.length===0?<p role="alert">No purchase lines loaded. Do not receive this order until records are verified.</p>:o.status!=='received'&&canReceive?<PartialReceiptForm purchaseId={o.id} items={receiptLines}/>:<ul>{receiptLines.map(i=><li key={i.id}>{i.product_name}: {i.received} of {i.ordered} received</li>)}</ul>}</details></td></tr>;
   })}</tbody></table></div>{orders.length===0&&<p className="muted">No purchase orders yet.</p>}
  </BusinessSection>
  {canApproveBills&&<BusinessSection title="Supplier bills and payments" description="Record a supplier invoice after receiving goods. Payables here are manually registered, not automatically generated from purchase drafts.">
   {!financialDataReady?<BusinessAlert>Supplier bill or payment records could not be verified. Check migration 038 before recording money.</BusinessAlert>:<>
    <div className="grid grid-2"><section className="card card-pad"><h3>Register supplier invoice</h3><SupplierBillForm purchases={orders.filter(o=>o.status!=='draft').map(o=>({id:o.id,label:`${o.reference} — ${names.get(o.supplier_id)||'Supplier'}`}))}/></section><section className="card card-pad"><h3>Supplier balance information</h3><p className="small muted">Use the supplier's actual invoice. The purchase-order estimate and received-goods value may differ from the amount billed.</p><p><strong>Outstanding on loaded registered bills: {money(supplierOutstanding)}</strong></p><p className="small muted">This is not a complete accounts payable ledger and does not replace accounting reconciliation.</p></section></div>
    <div className="table-wrap"><table className="table"><thead><tr><th>Supplier / Invoice</th><th>Amount</th><th>Paid</th><th>Outstanding</th><th>Due</th><th>Verified payment</th></tr></thead><tbody>{bills.map(b=>{const paid=paidByBill.get(b.id)||0,outstanding=Math.max(0,Number(b.invoice_amount)-paid);return <tr key={b.id}><td><strong>{names.get(b.supplier_id)||'Supplier'}</strong><div className="small muted">{b.supplier_invoice_number}</div></td><td>{money(Number(b.invoice_amount))}</td><td>{money(paid)}</td><td>{money(outstanding)}</td><td>{b.due_on||'—'}</td><td>{outstanding>0?<details><summary>Record payment</summary><SupplierPaymentForm billId={b.id} outstanding={outstanding}/></details>:'Settled'}</td></tr>})}</tbody></table></div>{!bills.length&&<p className="muted">No supplier invoices registered yet.</p>}
   </>}
  </BusinessSection>}
  <BusinessSection title="Supplier directory" description="Supplier contact records are only visible to authorised workspace users.">
   <div className="table-wrap"><table className="table"><thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>Email</th></tr></thead><tbody>{suppliers.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.contact_name||'—'}</td><td>{s.phone||'—'}</td><td>{s.email||'—'}</td></tr>)}</tbody></table></div>
  </BusinessSection>
  <p className="small muted">Goods are received into company-wide inventory. Branch-specific transfers are not enabled yet because POS, stock counts and returns must all use consistent branch-aware quantities first. No automatic supplier payment, tax filing or general-ledger posting occurs.</p>
 </div>;
}
