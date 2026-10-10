'use client';
import {useActionState} from 'react';
import {configureAutomationRule,toggleAutomationRule,type AdminAutomationState} from './actions';
const initial:AdminAutomationState={ok:false,message:''};
export function AutomationRuleForm({requestId,title,existing}:{requestId:string;title:string;existing?:{message:string;cadence_hours:number;max_runs:number;enabled:boolean;next_run_at:string;id:string;run_count:number}|null}){
 const [result,submit,pending]=useActionState(configureAutomationRule,initial);
 const [toggleResult,toggle,pendingToggle]=useActionState(toggleAutomationRule,initial);
 return <div className="automation-rule-box" style={{marginTop:15,padding:15,border:'1px solid #dbe5ef',borderRadius:12}}>
  <h3>Scheduled task reminder</h3>
  <p className="small muted">Only after quotation acceptance and setup review. All schedules use UTC. Saving pauses an existing rule until reactivated.</p>
  {existing&&<p className="small"><strong>{existing.enabled?'Active':'Paused'}</strong> · {existing.run_count} of {existing.max_runs} executions · Next {new Date(existing.next_run_at).toLocaleString('en-GB',{timeZone:'UTC'})} UTC</p>}
  <form action={submit} className="comms-form">
   <input type="hidden" name="request_id" value={requestId}/>
   <label>Reminder text for {title}<textarea name="message" required minLength={8} maxLength={500} rows={3} defaultValue={existing?.message||`Reminder: ${title}`} /></label>
   <label>Repeat<select name="cadence_hours" defaultValue={String(existing?.cadence_hours||24)}><option value="24">Every 24 hours</option><option value="168">Every 7 days</option></select></label>
   <label>First execution (UTC)<input name="next_run_utc" type="datetime-local" required defaultValue={existing?.next_run_at?.slice(0,16)}/></label>
   <label>Maximum executions<input name="max_runs" type="number" min={1} max={365} step={1} required defaultValue={existing?.max_runs||7}/></label>
   <button className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Save schedule (paused)'}</button>
   {result.message&&<p role="status" className={result.ok?'positive':'negative'}>{result.message}</p>}
  </form>
  {existing&&<form action={toggle} className="comms-form" style={{marginTop:12}}>
   <input type="hidden" name="rule_id" value={existing.id}/>
   <input type="hidden" name="enabled" value={existing.enabled?'false':'true'}/>
   <button type="submit" className="btn" disabled={pendingToggle}>{existing.enabled?'Pause this reminder':'Activate this reminder'}</button>
   {toggleResult.message&&<p role="status" className={toggleResult.ok?'positive':'negative'}>{toggleResult.message}</p>}
  </form>}
 </div>;
}
