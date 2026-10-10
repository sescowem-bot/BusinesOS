'use client';
import {useActionState} from 'react';
import {requestUpgrade,type UpgradeResult} from './actions';
const initial:UpgradeResult={ok:false,message:''};
export function UpgradeRequestForm({planId,disabled}:{planId:string;disabled:boolean}){
 const [state,action,pending]=useActionState(requestUpgrade,initial);
 return <form action={action}>
  <input type="hidden" name="plan_id" value={planId}/>
  <label className="field">Reason for upgrade (optional)<textarea name="reason" rows={2} maxLength={1200}/></label>
  <button className="btn btn-primary" type="submit" disabled={disabled||pending}>{pending?'Submitting…':disabled?'Unavailable':'Request upgrade'}</button>
  {state.message&&<p className={`small ${state.ok?'muted':'negative'}`} role="status">{state.message}</p>}
 </form>;
}
