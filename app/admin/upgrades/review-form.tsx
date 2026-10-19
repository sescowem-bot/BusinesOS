'use client';
import {useActionState} from 'react';
import {reviewUpgrade,type ReviewResult} from './actions';
const initial:ReviewResult={ok:false,message:''};
export function ReviewUpgradeForm({requestId}:{requestId:string}){
 const [result,action,pending]=useActionState(reviewUpgrade,initial);
 return <form action={action}>
  <input type="hidden" name="request_id" value={requestId}/>
  <label className="field">Response to business owner <textarea name="note" minLength={5} maxLength={1200} rows={2} required placeholder="Explain the next step, invoice or reason for declining."/></label>
  <div style={{display:'flex',gap:8,marginTop:10}}><button type="submit" disabled={pending||result.ok} className="btn btn-primary" name="decision" value="approve">{pending?'Saving…' :'Accept request'}</button><button type="submit" disabled={pending||result.ok} className="btn" name="decision" value="reject">Decline</button></div>
  <p className="small muted">Accepting a request does not charge the customer or activate a paid subscription. Use verified checkout or a separate audited manual assignment.</p>
  {result.message&&<p role="status" className={`small ${result.ok?'muted':'negative'}`}>{result.message}</p>}
 </form>;
}
