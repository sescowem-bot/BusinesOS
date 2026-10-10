import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {InvoiceIdentityForm} from './identity-form';
export const dynamic='force-dynamic';
export default async function InvoiceSettings(){
 const {client,businessId,role}=await getWorkspace();
 const {data,error}=await client.from('business_invoice_profiles').select('logo_url,display_name,registration_number,tax_identification_number,bank_name,account_name,account_number,footer_note').eq('business_id',businessId).maybeSingle();
 return <div className="tax-page"><p className="small muted">BUSINESS / DOCUMENTS</p><h1>Invoice design and identity</h1><p className="muted">Configure your business identity, payment instructions and branding for newly issued invoices.</p><p><Link href="/invoices">← Back to invoices</Link></p>{error?<div className="notice">Invoice settings are unavailable. Confirm SQL migration 032 before editing.</div>:<InvoiceIdentityForm owner={role==='owner'} defaults={Object.fromEntries(Object.entries(data||{}).map(([key,value])=>[key,String(value||'')]))}/>}
 <section className="tax-panel"><h2>Tax configuration</h2><p>VAT is calculated only for new orders using an approved classification and verified tax profile. Invoices preserve the amounts originally charged. The document does not replace an NRS-validated electronic invoice.</p><p><Link className="btn" href="/tax-centre">Open Tax Centre</Link></p></section></div>;
}
