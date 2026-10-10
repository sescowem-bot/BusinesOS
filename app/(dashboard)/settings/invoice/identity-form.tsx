'use client';
import {useActionState} from 'react';
import {saveInvoiceIdentity,type InvoiceIdentityState} from '../invoice-actions';
const initial:InvoiceIdentityState={message:'',error:''};
const fields=[
 {key:'display_name',label:'Business name on invoices',max:160},
 {key:'logo_url',label:'Business logo HTTPS URL (optional)',max:1500},
 {key:'registration_number',label:'Registration number (RC / BN)',max:80},
 {key:'tax_identification_number',label:'Tax identification number (TIN)',max:80},
 {key:'bank_name',label:'Bank name',max:120},
 {key:'account_name',label:'Account name',max:160},
 {key:'account_number',label:'Account number',max:40},
 {key:'footer_note',label:'Short invoice footer / thank you note',max:360}
] as const;
export function InvoiceIdentityForm({defaults,owner}:{defaults:Record<string,string>;owner:boolean}){
 const [state,action,pending]=useActionState(saveInvoiceIdentity,initial);
 return <form className="tax-panel" action={action} style={{display:'grid',gap:16}}>
  <h2 style={{margin:0}}>Invoice appearance and payment details</h2>
  <p className="muted small">These details are captured when an invoice is first issued. Enter only your business's correct identity and bank information. A TIN here does not certify a tax invoice.</p>
  <div className="form-grid">{fields.map(f=><label className="field" key={f.key}>{f.label}<input name={f.key} maxLength={f.max} defaultValue={defaults[f.key]||''} disabled={!owner} autoComplete="off"/></label>)}</div>
  {owner?<button className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Save invoice identity'}</button>:<p className="muted">Only business owners can edit invoice identity.</p>}
  {state.error&&<p role="alert" className="negative">{state.error}</p>}{state.message&&<p role="status" className="positive">{state.message}</p>}
 </form>;
}
