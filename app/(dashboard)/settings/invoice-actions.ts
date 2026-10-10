'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export type InvoiceIdentityState={message:string;error:string};
export async function saveInvoiceIdentity(_:InvoiceIdentityState,form:FormData):Promise<InvoiceIdentityState>{
 try {
  const {client,businessId,role}=await getWorkspace();
  if(role!=='owner')return {message:'',error:'Only the business owner may change invoice identity.'};
  const fields=['logo_url','display_name','registration_number','tax_identification_number','bank_name','account_name','account_number','footer_note'] as const;
  const limits={logo_url:1500,display_name:160,registration_number:80,tax_identification_number:80,bank_name:120,account_name:160,account_number:40,footer_note:360};
  const values=Object.fromEntries(fields.map(k=>[k,String(form.get(k)||'').trim()]));
  if(fields.some(k=>values[k].length>limits[k]))return {message:'',error:'One or more fields exceed their maximum length.'};
  if(values.logo_url&&!/^https:\/\//.test(values.logo_url))return {message:'',error:'Use an HTTPS logo URL or leave the field empty.'};
  const {error}=await client.from('business_invoice_profiles').upsert({business_id:businessId,...values,updated_at:new Date().toISOString()},{onConflict:'business_id'});
  if(error)return {message:'',error:'Cannot save invoice identity. Confirm SQL migration 032 and your owner access.'};
  revalidatePath('/settings/invoice');revalidatePath('/invoices');
  return {message:'Invoice identity saved. It will appear on NEW invoices; already-issued documents are unchanged.',error:''};
 }catch{return {message:'',error:'Could not save the invoice settings. Please try again.'};}
}
