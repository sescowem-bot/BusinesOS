'use client';
import {useActionState} from 'react';
import {saveBusinessReview} from './actions';
export function BusinessReviewForm({businessId,status,note}:{businessId:string;status:string;note:string}){
 const [state,action,pending]=useActionState(saveBusinessReview,{ok:false,message:''});
 return <form action={action} className="admin-form">
  <h2>Internal review</h2><p className="small muted">Administrative notes are private to Platform Admins. Review status does not suspend an account or restrict business access.</p>
  <input type="hidden" name="business_id" value={businessId}/>
  <label>Review status<select name="status" defaultValue={status}><option value="open">Open</option><option value="review">Needs review</option><option value="resolved">Resolved</option></select></label>
  <label>Review notes<textarea name="note" defaultValue={note} rows={5} maxLength={3000} placeholder="Record the reason, follow-up action or resolution…"/></label>
  <button className="btn btn-primary" disabled={pending} type="submit">{pending?'Saving…':'Save review'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
