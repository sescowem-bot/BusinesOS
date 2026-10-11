'use client';
import {useActionState} from 'react';
import {applyStandardPlanMatrix,type TierMatrixState} from './tier-actions';
const initial:TierMatrixState={ok:false,message:''};
export function TierAlignmentForm(){
 const [result,action,pending]=useActionState(applyStandardPlanMatrix,initial);
 return <form action={action} className="bo-tier-align-form">
  <label htmlFor="tier-confirm">To use the suggested Starter, Growth and Professional features, type <strong>APPLY STANDARD PLANS</strong></label>
  <input id="tier-confirm" name="confirmation" placeholder="APPLY STANDARD PLANS" required autoComplete="off"/>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Updating plans…':'Apply plan differences'}</button>
  {result.message&&<p role="status" className={result.ok?'positive':'small muted'}>{result.message}</p>}
 </form>;
}
