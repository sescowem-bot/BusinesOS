import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {VatEstimator} from './vat-estimator';
export const dynamic='force-dynamic';

type Supply={id:string;name:string;supply_kind:string};
type Rule={treatment:string;rate_basis_points:number;status:string;tax_kind:string;effective_from:string;effective_to:string|null};
type Assignment={supply_id:string;status:string;tax_rule_versions:Rule|Rule[]|null};
export default async function TaxCentre(){
 const access=await requireBusinessFeature('tax');
 if(!access.allowed)return <section className="tax-page"><h1>Tax Centre</h1><p role="alert">{access.reason}</p><Link href="/upgrade">View plans</Link></section>;
 const {client,businessId}=access;
 const [suppliesResult,assignmentResult]=await Promise.all([
  client.from('business_supply_categories').select('id,name,supply_kind').eq('business_id',businessId).order('name').limit(500),
  client.from('business_tax_assignments').select('supply_id,status,tax_rule_versions(treatment,rate_basis_points,status,tax_kind,effective_from,effective_to)').eq('business_id',businessId).limit(1000)
 ]);
 const unavailable=suppliesResult.error||assignmentResult.error;
 const today=new Date().toISOString().slice(0,10);
 const supplies=(suppliesResult.data||[]) as Supply[];
 const assignments=(assignmentResult.data||[]) as unknown as Assignment[];
 const mapped=supplies.map(s=>{
  const applicable=assignments.flatMap(a=>{
   if(a.supply_id!==s.id||a.status!=='approved')return [];
   const rule=Array.isArray(a.tax_rule_versions)?a.tax_rule_versions[0]:a.tax_rule_versions;
   if(!rule||rule.status!=='approved'||rule.tax_kind!=='vat'||rule.effective_from>today|| (rule.effective_to!==null&&rule.effective_to<today))return [];
   return [rule];
  });
  // Multiple overlapping, approved rules are ambiguous; require human review.
  const rule=applicable.length===1?applicable[0]:null;
  // Estimator currently assumes a fixed 7.5% for standard lines and zero otherwise;
  // do not pass mismatched rule rates as approved.
  const supported=rule&&(rule.treatment==='standard'&&rule.rate_basis_points===750 ||
   ['zero_rated','exempt','outside_scope'].includes(rule.treatment)&&rule.rate_basis_points===0);
  const approved=Boolean(supported);
  return {id:s.id,name:s.name,kind:s.supply_kind,treatment:approved?rule!.treatment:'needs_review',approved,ruleLabel:applicable.length>1?'Conflicting approved rules':rule&&!supported?'Rate requires review':approved?'Effective approved rule':'Needs review'};
 });
 const approvedCount=mapped.filter(s=>s.approved).length;
 return <div className="tax-page"><p className="muted small">FINANCE / TAX CLASSIFICATION</p><h1>Tax Centre</h1>
  <p className="muted">Check current item classifications before preparing provisional figures. This is not a tax assessment or a filing service.</p>
  <section className="tax-notice"><strong>Legal and tax review required before charging customers.</strong><p>A preview is never authority to apply VAT. Classifications require approved rules effective on the transaction date and verified business eligibility. The estimator uses a fixed illustrative standard rate and must not be used for historical or future transactions without independent review.</p></section>
  {unavailable&&<p role="alert" className="negative">Tax classification data could not be verified. Check migrations 005 and 009. No items are treated as approved.</p>}
  <div className="grid grid-3"><section className="tax-panel"><p className="small muted">Supplies displayed</p><h2>{mapped.length}</h2></section><section className="tax-panel"><p className="small muted">Current unambiguous classifications</p><h2>{unavailable?0:approvedCount}</h2></section><section className="tax-panel"><p className="small muted">Requiring review</p><h2>{unavailable?mapped.length:mapped.length-approvedCount}</h2></section></div>
  <section className="tax-panel"><h2>Classification review list</h2><p className="muted small">Current date: {today}. Rules for a past invoice date must be assessed separately.</p><div className="table-wrap"><table className="table"><thead><tr><th>Item or service</th><th>Kind</th><th>Tax treatment</th><th>Review state</th></tr></thead><tbody>{mapped.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.kind}</td><td>{s.approved?s.treatment.replaceAll('_',' '):'Unconfirmed'}</td><td>{unavailable?'Unavailable':s.ruleLabel}</td></tr>)}</tbody></table></div>{!mapped.length&&<p className="muted">No supplies recorded. <Link href="/tax-profile">Open Tax Discovery</Link> to register them.</p>}</section>
  {!unavailable&&<section className="tax-panel"><h2>VAT estimator (non-posting)</h2><VatEstimator items={mapped.map(s=>({id:s.id,name:s.name,kind:s.kind,treatment:s.treatment,approved:s.approved}))}/></section>}
  <section className="tax-panel"><h2>Before statutory use</h2><p className="muted">Check the original legislation, the applicable tax period, customer and business eligibility, exemptions and the correct rate. The platform does not submit returns, automatically charge VAT or remit taxes.</p><p><a href="https://nass.gov.ng/documents/download/11249" target="_blank" rel="noopener noreferrer">Nigeria Tax Act 2025 (National Assembly)</a></p></section>
 </div>;
}
