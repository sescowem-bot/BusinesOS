import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {BusinessPageHeading,BusinessSection,BusinessAlert} from '@/components/business-page-ui';
import {MappingForm} from './mapping-form';
export const dynamic='force-dynamic';
export default async function POSTaxMappings(){
 const access=await requireBusinessFeature('pos');
 if(!access.allowed)return <div className="bo-page"><BusinessPageHeading eyebrow="POS / VAT" title="Product tax categories" description="Available with an authorised POS subscription."/><BusinessAlert>{access.reason}</BusinessAlert></div>;
 const {client,businessId,role}=access;
 if(!['owner','manager'].includes(role))return <div className="bo-page"><BusinessPageHeading eyebrow="POS / VAT" title="Product tax categories" description="Owner or manager access required."/><BusinessAlert>You cannot edit product tax-category mappings.</BusinessAlert></div>;
 const [products,supplies,assignments,mappings]=await Promise.all([
  client.from('products').select('id,name,sku').eq('business_id',businessId).eq('active',true).order('name').limit(500),
  client.from('business_supply_categories').select('id,name').eq('business_id',businessId).order('name').limit(500),
  client.from('business_tax_assignments').select('supply_id,status,tax_rule_versions(status,tax_kind,treatment,rate_basis_points,effective_from,effective_to)').eq('business_id',businessId).eq('status','approved').limit(1000),
  client.from('business_product_tax_mappings').select('product_id,supply_id').eq('business_id',businessId).limit(500)
 ]);
 const errors=[products.error,supplies.error,assignments.error,mappings.error].filter(Boolean);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const count=new Map<string,number>();
 for(const a of assignments.data||[]){const t=Array.isArray(a.tax_rule_versions)?a.tax_rule_versions[0]:a.tax_rule_versions;
  if(!t||t.status!=='approved'||t.tax_kind!=='vat'||t.effective_from>today||t.effective_to&&t.effective_to<today)continue;
  if(!((t.treatment==='standard'&&t.rate_basis_points===750)||(['zero_rated','exempt','outside_scope'].includes(t.treatment)&&t.rate_basis_points===0)))continue;
  count.set(a.supply_id,(count.get(a.supply_id)||0)+1);
 }
 const approved=(supplies.data||[]).filter(s=>count.get(s.id)===1);
 const supplyNames=new Map((supplies.data||[]).map(s=>[s.id,s.name]));
 const mapped=new Map((mappings.data||[]).map(m=>[m.product_id,m.supply_id]));
 return <div className="bo-page"><BusinessPageHeading eyebrow="POS / TAX SETUP" title="Product tax categories" description="Map a product to an existing supply classification. Only a separately approved, currently effective VAT rule can make it eligible for reviewed checkout." action={{href:'/pos',label:'Back to POS'}}/>
 <BusinessAlert>Mapping a product does not approve its tax treatment. Legal classifications must be reviewed through the trusted Tax Centre process. VAT-exclusive NGN prices only; no discounts or delivery VAT in this checkout release. <Link href="/tax-centre">Review Tax Centre</Link>.</BusinessAlert>
 {errors.length>0?<BusinessAlert>Tax mapping data could not be loaded. Check SQL 033 and permissions. Nothing can be changed until all datasets load.</BusinessAlert>:<>
 <BusinessSection title="Assign reviewed category" description="Only categories with exactly one current, approved and supported VAT rule are offered.">
 {approved.length>0?<MappingForm products={(products.data||[]).map(p=>({id:p.id,name:p.name}))} supplies={approved}/>:<BusinessAlert>No approved VAT supply categories are available. Request legal review of supply classifications before mapping products.</BusinessAlert>}
 </BusinessSection>
 <BusinessSection title="Product classification register" description="The current mapping status is checked again by the database for every checkout."><div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Assigned category</th><th>Checkout readiness</th></tr></thead><tbody>{(products.data||[]).map(p=>{const id=mapped.get(p.id),ready=Boolean(id&&count.get(id)===1);return <tr key={p.id}><td>{p.name}</td><td>{id?supplyNames.get(id)||'Unavailable':'Not mapped'}</td><td>{ready?'Rule approved for today':'Needs review'}</td></tr>})}</tbody></table></div>{products.data?.length===500&&<BusinessAlert>Only the first 500 products are shown. Additional catalogue search and server-side pagination are required for larger businesses.</BusinessAlert>}</BusinessSection>
 </>}
 </div>;
}
