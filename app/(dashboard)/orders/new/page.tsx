import {randomUUID} from 'node:crypto';
import {customerNameFromRelation} from '@/lib/customer-relations';
import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {redirect} from 'next/navigation';
import {coreActionAllowed} from '@/lib/server/core-action-permissions';
import {OrderForm} from '../../sales/forms';
import {ReviewedTaxForm} from './reviewed-tax-form';
import {BusinessPageHeading,BusinessAlert} from '@/components/business-page-ui';
export const dynamic='force-dynamic';
type Rule={treatment:string;rate_basis_points:number;status:string;tax_kind:string;effective_from:string;effective_to:string|null};
export default async function NewOrder({searchParams}:{searchParams:Promise<{customer?:string}>}){
 const {customer:requestedCustomer}=await searchParams;
 const access=await getWorkspace();const {client,businessId,role}=access;
 if(!['owner','manager','finance','sales'].includes(role)||!(await coreActionAllowed(access,'orders','create')))redirect('/orders');
 const canRecordCost=['owner','manager','finance'].includes(role);
 // The tax profile determines the ONLY permitted form; ordinary workspaces do not
 // load the more expensive tax supply/classification joins.
 const [customersResult,taxProfile]=await Promise.all([
  client.from('business_customers').select('customer_id,customers(name)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(500),
  client.from('business_tax_profiles').select('vat_registration_status,classification_status').eq('business_id',businessId).maybeSingle()
 ]);
 const title=<BusinessPageHeading eyebrow="SALES / CREATE ORDER" title="Create a customer order" description="Select the customer, enter what you are selling and record any payment received. You'll see the balance after saving."/>;
 if(customersResult.error||taxProfile.error)return <div className="bo-page bo-form-page">{title}<BusinessAlert>Customer or tax information could not be verified. To protect your records, order creation is unavailable until the data loads. Please refresh or <Link href="/support">contact support</Link>.</BusinessAlert></div>;
 const customers=(customersResult.data||[]).map(v=>({id:v.customer_id,name:customerNameFromRelation(v.customers,'')})).filter(c=>c.name);
 // A customer found on page 401 of the directory must still be preselected,
 // even when the normal order form loads only the 500 newest customer choices.
 const knownId=typeof requestedCustomer==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedCustomer);
 if(knownId&&!customers.some(c=>c.id===requestedCustomer)){
  const linked=await client.from('business_customers').select('customer_id,customers(name)')
   .eq('business_id',businessId).eq('customer_id',requestedCustomer).maybeSingle();
  if(linked.error)return <div className="bo-page bo-form-page">{title}<BusinessAlert>Selected customer could not be verified. Please open the customer directory again before creating an order.</BusinessAlert></div>;
  if(linked.data){
   const name=customerNameFromRelation(linked.data.customers,'');
   if(name)customers.unshift({id:linked.data.customer_id,name});
  }
 }
 const initialCustomerId=customers.some(c=>c.id===requestedCustomer)?requestedCustomer:'';
 const registered=taxProfile.data?.vat_registration_status==='registered';
 const reviewed=taxProfile.data?.classification_status==='reviewed';
 // A registered but not-yet-reviewed business must not fall back to the ordinary flow.
 const mustUseTaxForm=registered;
 let reviewedSupplies:Array<{id:string;name:string;treatment:string;rateBasisPoints:number}>=[];
 let taxError=false;
 if(registered&&reviewed){
  const [assignments,suppliesResult]=await Promise.all([
   client.from('business_tax_assignments').select('supply_id,status,tax_rule_versions(treatment,rate_basis_points,status,tax_kind,effective_from,effective_to)').eq('business_id',businessId).eq('status','approved').limit(500),
   client.from('business_supply_categories').select('id,name').eq('business_id',businessId).limit(500)
  ]);
  taxError=Boolean(assignments.error||suppliesResult.error||assignments.data?.length===500||suppliesResult.data?.length===500);
  if(!taxError){
   const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const approved=new Map<string,Rule[]>();
   for(const a of assignments.data||[]){
    const rule=(Array.isArray(a.tax_rule_versions)?a.tax_rule_versions[0]:a.tax_rule_versions) as Rule|null;
    if(!rule||rule.status!=='approved'||rule.tax_kind!=='vat'||rule.effective_from>date||(rule.effective_to!==null&&rule.effective_to<date))continue;
    approved.set(a.supply_id,[...(approved.get(a.supply_id)||[]),rule]);
   }
   reviewedSupplies=(suppliesResult.data||[]).flatMap(s=>{
    const rules=approved.get(s.id)||[];
    if(rules.length!==1)return [];
    const r=rules[0];
    if(!((r.treatment==='standard'&&r.rate_basis_points===750)||(['zero_rated','exempt','outside_scope'].includes(r.treatment)&&r.rate_basis_points===0)))return [];
    return [{id:s.id,name:s.name,treatment:r.treatment,rateBasisPoints:r.rate_basis_points}];
   });
  }
 }
 return <div className="bo-page bo-form-page bo-guided-order">
  {title}
  <nav className="bo-form-back" aria-label="Order navigation"><Link href="/orders">← All orders</Link><Link href="/getting-started">Need help? View the quick guide →</Link></nav>
  <ol className="bo-creation-steps" aria-label="Three steps to create an order">
   <li><strong>1</strong><span>Choose a customer</span></li>
   <li><strong>2</strong><span>Enter item and price</span></li>
   <li><strong>3</strong><span>Confirm payment</span></li>
  </ol>
  {!customers.length?<section className="bo-form-panel bo-form-empty"><h2>Add your first customer</h2><p>A customer must be attached to an order so payments and outstanding balances can be tracked correctly.</p><Link className="btn btn-primary" href="/customers/new">Add customer</Link></section>:
   mustUseTaxForm?<section className="bo-form-panel"><div className="bo-form-head"><p className="bo-eyebrow">REVIEWED VAT ORDER</p><h2>Order details and payment</h2><p>VAT is calculated from your approved settings when you save. You can check the customer's balance after creating the order.</p></div>
    {reviewed&&!taxError&&reviewedSupplies.length?<ReviewedTaxForm customers={customers} supplies={reviewedSupplies} requestKey={randomUUID()} canRecordCost={canRecordCost} initialCustomerId={initialCustomerId}/>:<BusinessAlert>{!reviewed?'Your VAT registration needs a reviewed classification before this order can be created.':taxError?'Approved tax records could not be loaded completely. Order creation is paused to prevent an inaccurate VAT calculation.':'There is no currently approved product or service classification for a reviewed VAT order.'} <Link href="/tax-centre">Open Tax Centre</Link>.</BusinessAlert>}
   </section>:
   <section className="bo-form-panel"><div className="bo-form-head"><p className="bo-eyebrow">CUSTOMER ORDER</p><h2>Order details and payment</h2><p>Enter the agreed price, then select Not paid, Part payment or Paid in full. This form does not collect money online.</p></div><OrderForm customers={customers} requestKey={randomUUID()} canRecordCost={canRecordCost} initialCustomerId={initialCustomerId}/></section>
  }
  {customersResult.data?.length===500&&<BusinessAlert>For faster loading, the customer dropdown starts with 500 recent contacts. To use an older customer, search the Customers directory and select Create order on that record.</BusinessAlert>}
  <div className="bo-order-help"><strong>What happens after saving?</strong><p>BusinessOS creates the order and records any confirmed initial payment together. You can view the amount paid, outstanding balance and payment history from the order details page.</p></div>
 </div>;
}
