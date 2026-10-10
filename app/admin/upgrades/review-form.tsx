'use client';
import {useActionState} from 'react';
import {reviewUpgrade,type ReviewResult} from './actions';
const initial:ReviewResult={ok:false,message:''};
export function ReviewUpgradeForm({requestId}:{requestId:string}){
 const [result,action,pending]=useActionState(reviewUpgrade,initial);
 return <form action={action}>
  <input type="hidden" name="request_id" value={requestId}/>
  <label className="field">Review note <textarea name="note" maxLength={1200} rows={2}/></label>
  <div style={{display:'flex',gap:8,marginTop:10}}><button type="submit" disabled={pending||result.ok} className="btn btn-primary" name="decision" value="approve">{pending?'Saving…':'Approve'}</button><button type="submit" disabled={pending||result.ok} className="btn" name="decision" value="reject">Reject</button></div>
  {result.message&&<p role="status" className={`small ${result.ok?'muted':'negative'}`}>{result.message}</p>}
 </form>;
}
