import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {VatEstimator} from './vat-estimator';
export default async function TaxCentre(){
 const {client,businessId}=await getWorkspace();
 const [{data:supplies,error:suppliesError},{data:assignments,error:assignmentsError}]=await Promise.all([
 client.from('business_supply_categories').select('id,name,supply_kind').eq('business_id',businessId).order('name'),
 client.from('business_tax_assignments').select('supply_id,status,rule_version_id,tax_rule_versions(treatment,rate_basis_points,status)').eq('business_id',businessId)
 ]);
 const mapped=(supplies||[]).map(s=>{
 const found=(assignments||[]).find((a:any)=>a.supply_id===s.id&&a.status==='approved'&&(Array.isArray(a.tax_rule_versions)?a.tax_rule_versions[0]?.status:a.tax_rule_versions?.status)==='approved');
 const rule:any=found?.tax_rule_versions;const details=Array.isArray(rule)?rule[0]:rule;
 return {id:s.id,name:s.name,kind:s.supply_kind,treatment:found?details?.treatment:'needs_review',approved:!!found&&!!details};
 });
 return <div className="tax-page"><p className="muted small">FINANCE / TAX INTELLIGENCE</p><h1>Tax Centre</h1><p className="muted">Review item classifications and preview mixed invoices. This is not a filed return, a tax assessment or an instruction to charge VAT.</p>
 <section className="tax-notice"><strong>Legal review required before charging taxes</strong><p>Products need an approved, effective-dated statutory rule and verified business VAT status. This early release never posts tax to the ledger or automatically charges a customer.</p></section>
 {(suppliesError||assignmentsError)&&<p role="alert" className="negative">Tax database unavailable. Apply migration 009 after prior migrations.</p>}
 <section className="tax-panel"><h2>Business supply classifications</h2><p className="muted">A separate code can apply to each item. All unreviewed items remain blocked from automatic tax use.</p><div className="table-wrap"><table className="table"><thead><tr><th>Item / service</th><th>Type</th><th>Classification</th></tr></thead><tbody>{mapped.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.kind}</td><td><span className="badge">{s.approved?s.treatment.replaceAll('_',' '):'Needs review'}</span></td></tr>)}</tbody></table></div>{!mapped.length&&<p className="muted">No supplies saved. <Link href="/tax-profile">Add your business supplies</Link> first.</p>}</section>
 <section className="tax-panel"><h2>Mixed-invoice VAT estimator</h2><VatEstimator items={mapped}/></section>
 <section className="tax-panel"><h2>Legal foundation</h2><p className="muted">Rules are versioned, with legal citations and effective dates. Standard, zero-rated, exempt and outside-scope are distinct classifications. Pending classifications are not assumed standard-rated.</p><p><a href="https://nass.gov.ng/documents/download/11249" target="_blank" rel="noopener noreferrer">Nigeria Tax Act 2025 (National Assembly)</a></p><p><a href="https://fmino.gov.ng/federal-government-issues-transition-guidelines-for-tax-acts-2025/" target="_blank" rel="noopener noreferrer">2026 transition guidance</a></p></section>
 </div>;
}
