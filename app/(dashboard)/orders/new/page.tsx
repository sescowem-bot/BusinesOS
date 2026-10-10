import {randomUUID} from 'node:crypto';
import {customerNameFromRelation} from '@/lib/customer-relations';
import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {OrderForm} from '../../sales/forms';
import {ReviewedTaxForm} from './reviewed-tax-form';
import {BusinessPageHeading,BusinessAlert} from '@/components/business-page-ui';
export const dynamic='force-dynamic';
export default async function NewOrder(){
 const {client,businessId,role}=await getWorkspace();
 const canRecordCost=['owner','manager','finance'].includes(role);
 const normalRequestKey=randomUUID(),reviewedRequestKey=randomUUID();
 const [{data:links,error},taxProfile,assignments,suppliesResult]=await Promise.all([
 client.from('business_customers').select('customer_id,customers(name)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(500),
 client.from('business_tax_profiles').select('vat_registration_status,classification_status').eq('business_id',businessId).maybeSingle(),
 client.from('business_tax_assignments').select('supply_id,status,tax_rule_versions(treatment,rate_basis_points,status,tax_kind,effective_from,effective_to)').eq('business_id',businessId).eq('status','approved').limit(500),
 client.from('business_supply_categories').select('id,name').eq('business_id',businessId).limit(500)
 ]);
 if(error)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / NEW ORDER" title="Create a sales order" description="Record a customer order using real workspace data."/><BusinessAlert>Customers cannot be loaded. Please retry before creating an order.</BusinessAlert></div>;
 const customers=(links||[]).map(v=>({id:v.customer_id,name:customerNameFromRelation(v.customers, '')})).filter(c=>c.name);
 type Rule={treatment:string;rate_basis_points:number;status:string;tax_kind:string;effective_from:string;effective_to:string|null};
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const approved=new Map<string,Rule[]>();
 for(const a of assignments.data||[]){const r=(Array.isArray(a.tax_rule_versions)?a.tax_rule_versions[0]:a.tax_rule_versions) as Rule|null;
  if(!r||r.status!=='approved'||r.tax_kind!=='vat'||r.effective_from>today||(r.effective_to!==null&&r.effective_to<today))continue;
  approved.set(a.supply_id,[...(approved.get(a.supply_id)||[]),r]);}
 const reviewedSupplies=(suppliesResult.data||[]).flatMap(s=>{const rules=approved.get(s.id)||[];
  if(rules.length!==1)return [];const r=rules[0];if(!((r.treatment==='standard'&&r.rate_basis_points===750)||(['zero_rated','exempt','outside_scope'].includes(r.treatment)&&r.rate_basis_points===0)))return [];
  return [{id:s.id,name:s.name,treatment:r.treatment,rateBasisPoints:r.rate_basis_points}];});
 const businessVerified=taxProfile.data?.classification_status==='reviewed'&&taxProfile.data?.vat_registration_status==='registered';
 return <div className="bo-page bo-form-page"><BusinessPageHeading eyebrow="SALES / NEW ORDER" title="Create a sales order" description="Save a new order with the customer, item details and agreed amount. Record the order and its initial payment together, then see the balance immediately."/><p className="bo-back-link"><Link href="/orders">← Back to orders</Link></p><section className="bo-form-panel"><div className="bo-form-head"><h2>Order details</h2><p>Confirm the customer and amounts carefully. The original order will be used for subsequent statements and invoices.</p></div>{businessVerified?<BusinessAlert>This business has reviewed VAT registration. Use the verified-tax form below; unclassified orders cannot be created from this form.</BusinessAlert>:customers.length?<OrderForm customers={customers} requestKey={normalRequestKey} canRecordCost={canRecordCost}/>:<BusinessAlert>Add at least one customer before creating an order. <Link href="/customers/new">Create customer</Link>.</BusinessAlert>}{customers.length===500&&<p className="small muted">Only the most recent 500 customers are available here.</p>}</section>
  <section className="bo-form-panel" style={{marginTop:20}}><div className="bo-form-head"><h2>Verified tax order</h2><p>Calculate 2026 Nigerian VAT only where the business eligibility and product classification have been approved.</p></div>
   {businessVerified&&reviewedSupplies.length&&customers.length?<ReviewedTaxForm customers={customers} supplies={reviewedSupplies} requestKey={reviewedRequestKey} canRecordCost={canRecordCost}/>:<BusinessAlert>{taxProfile.error||assignments.error||suppliesResult.error?'Tax review data is unavailable. No automated VAT can be calculated.': 'Reviewed-tax orders require a verified VAT-registered business profile and an approved supply classification in Tax Centre.'} <Link href="/tax-centre">Review tax setup</Link>.</BusinessAlert>}
  </section></div>;
}
