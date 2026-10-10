'use client';
import {useActionState} from 'react';
import {reviewAutomation,type AdminAutomationState} from './actions';
const initial:AdminAutomationState={ok:false,message:''};
export function AutomationReviewForm({requestId,status}:{requestId:string;status:string}){
 const [state,action,pending]=useActionState(reviewAutomation,initial);
 return <form action={action} style={{display:'grid',gap:10,paddingTop:12}}>
  <input name="request_id" type="hidden" value={requestId}/>
  <label>Decision <select name="decision">{status==='requested'&&<option value="quote">Send quotation</option>}{['requested','quoted'].includes(status)&&<option value="decline">Decline request</option>}{status==='accepted'&&<option value="configured">Mark setup prepared (not live)</option>}</select></label>
  {status==='requested'&&<label>Quotation and conditions <textarea name="quote_note" rows={3} maxLength={1500} placeholder="Describe setup fee, ongoing cost (if any), scope, and consent requirements"/></label>}
  <label>Internal review note <textarea name="admin_note" rows={2} maxLength={1500}/></label>
  <button className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Save review'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
