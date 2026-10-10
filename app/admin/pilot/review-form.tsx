'use client';
import {useActionState} from 'react';
import {recordPilotResult,type PilotSaveResult} from './actions';
import type {PilotEnvironment,PilotStatus} from '@/lib/pilot-checklist';
const initial:PilotSaveResult={ok:false,message:''};
export function PilotReviewForm({testId,environment,status,evidence}:{testId:string;environment:PilotEnvironment;status:PilotStatus;evidence:string}){
 const [state,action,pending]=useActionState(recordPilotResult,initial);
 return <form action={action} className="pilot-review-form">
  <input name="test_id" value={testId} type="hidden" readOnly/>
  <input name="environment" value={environment} type="hidden" readOnly/>
  <label>Test result
   <select name="status" defaultValue={status} aria-label={`Result for ${testId}`}>
    <option value="not_tested">Not tested</option><option value="pass">Passed (manual evidence)</option>
    <option value="fail">Failed</option><option value="blocked">Blocked</option>
   </select>
  </label>
  <label>Evidence or issue reference (never include passwords, tokens or personal data)
   <textarea name="evidence" maxLength={3000} rows={2} defaultValue={evidence} placeholder="Test environment, commit SHA, redacted log or issue reference..."/>
  </label>
  <button type="submit" disabled={pending} className="btn btn-primary">{pending?'Saving…':'Save review'}</button>
  {state.message&&<p role={state.ok?'status':'alert'} className={state.ok?'pilot-form-ok':'pilot-form-error'}>{state.message}</p>}
 </form>;
}
