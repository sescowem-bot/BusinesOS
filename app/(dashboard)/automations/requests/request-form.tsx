'use client';
import {useActionState} from 'react';
import {requestAutomation,type AutomationState} from './actions';
const initial:AutomationState={ok:false,message:''};
export function AutomationRequestForm(){
 const [state,action,pending]=useActionState(requestAutomation,initial);
 return <form action={action} className="card card-pad" style={{display:'grid',gap:14}}>
  <h2>Request an automation</h2>
  <p className="small muted">Describe the task and desired schedule. Your request does not trigger email, charges or workflow execution.</p>
  <label>Automation type <select name="category" required><option value="task_reminders">Task and staff reminders</option><option value="payment_reminders">Outstanding payment reminders</option><option value="inventory_alerts">Low-stock alerts</option><option value="scheduled_reports">Scheduled business reports</option><option value="custom">Custom process</option></select></label>
  <label>Request title <input name="title" maxLength={160} minLength={5} placeholder="Remind staff every weekday" required/></label>
  <label>Describe the trigger, timing and action <textarea name="details" required minLength={20} maxLength={3000} rows={5} placeholder="When an invoice becomes overdue by seven days, send a reminder to the assigned finance staff. Only use approved customer contact preferences."/></label>
  <label>Preferred delivery <select name="channel"><option value="in_app">In-app notification</option><option value="email">Email (subject to consent and configuration)</option></select></label>
  <button type="submit" disabled={pending} className="btn btn-primary">{pending?'Sending request…':'Submit for review'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
