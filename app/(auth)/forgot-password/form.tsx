'use client';
import {useActionState,useEffect,useState} from 'react';
import {requestReset,type ResetState} from './actions';
const initial:ResetState={message:'',retryAfterSeconds:0,rateLimited:false};
export default function ForgotForm(){
 const [state,action,pending]=useActionState(requestReset,initial);
 const [wait,setWait]=useState(0);
 useEffect(()=>{if(state.retryAfterSeconds>0)setWait(state.retryAfterSeconds)},[state]);
 useEffect(()=>{if(wait<=0)return;const t=setTimeout(()=>setWait(n=>Math.max(0,n-1)),1000);return ()=>clearTimeout(t)},[wait]);
 return <form action={action} className="auth-friendly-form">
  <div className="field"><label htmlFor="recovery-email">Email address</label><input id="recovery-email" name="email" type="email" autoCapitalize="none" autoComplete="email" required placeholder="you@example.com"/></div>
  <button type="submit" className="btn btn-primary auth-submit" disabled={pending||wait>0}>{pending?'Requesting link…':wait>0?`Try again in ${wait}s`:'Send reset link'}</button>
  {state.message&&<div role={state.rateLimited?'alert':'status'} className={`auth-feedback ${state.rateLimited?'auth-feedback-error':'auth-feedback-success'}`}>{state.message}</div>}
 </form>;
}
