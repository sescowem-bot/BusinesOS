'use client';
import Link from 'next/link';
import {useActionState} from 'react';
import {issueInvoice, type IssueInvoiceState} from './actions';
const initial:IssueInvoiceState={error:'',invoiceId:''};
export function IssueInvoiceForm({orderId}:{orderId:string}){
 const [state,action,pending]=useActionState(issueInvoice,initial);
 if(state.invoiceId)return <div role="status"><p style={{color:'#16845b'}}>Commercial invoice issued and saved.</p><Link className="btn primary" href={`/invoices/issued/${state.invoiceId}`}>View issued invoice</Link></div>;
 return <form action={action} style={{display:'grid',gap:10,justifyItems:'start'}}>
   <input type="hidden" name="order_id" value={orderId}/>
   <button className="btn primary" type="submit" disabled={pending}>{pending?'Issuing…':'Issue numbered commercial invoice'}</button>
   <p className="muted small">This action creates a permanent snapshot and cannot be undone from this page. It is not a validated tax invoice.</p>
   {state.error&&<p role="alert" className="negative">{state.error}</p>}
 </form>;
}
