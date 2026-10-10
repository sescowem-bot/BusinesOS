'use client';
import {useActionState,useEffect,useState} from 'react';
import Link from 'next/link';
import {signUp,type SignupState} from './actions';
const initial:SignupState={error:'',success:'',retryAfterSeconds:0,reason:''};
export default function SignupForm(){
 const [state,action,pending]=useActionState(signUp,initial);
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
 const [countdown,setCountdown]=useState(0);
 const [password,setPassword]=useState('');
 useEffect(()=>{if(state.retryAfterSeconds>0)setCountdown(state.retryAfterSeconds)},[state]);
 useEffect(()=>{if(countdown<=0)return;const t=setTimeout(()=>setCountdown(x=>Math.max(0,x-1)),1000);return ()=>clearTimeout(t)},[countdown]);
 return <form action={action} className="auth-friendly-form">
  <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Your full name"/></div>
  <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" required maxLength={254} placeholder="you@example.com"/></div>
  <div className="field"><label htmlFor="password">Create password</label><div className="auth-password-wrap"><input id="password" name="password" type={showPassword?'text':'password'} required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} aria-describedby="password-guidance"/><button type="button" className="auth-password-toggle" onClick={()=>setShowPassword(x=>!x)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?'Hide':'Show'}</button></div><p className="auth-field-help" id="password-guidance">Use at least 12 characters. A longer, unique password is safer.</p></div>
  <div className="field"><label htmlFor="confirm_password">Confirm password</label><div className="auth-password-wrap"><input id="confirm_password" name="confirm_password" type={showConfirm?'text':'password'} required minLength={12} maxLength={128} autoComplete="new-password"/><button type="button" className="auth-password-toggle" onClick={()=>setShowConfirm(x=>!x)} aria-label={showConfirm?'Hide confirmation':'Show confirmation'} aria-pressed={showConfirm}>{showConfirm?'Hide':'Show'}</button></div></div>
  <button className="btn btn-primary auth-submit" disabled={pending||countdown>0||password.length<12||Boolean(state.success)}>{pending?'Creating your account…':countdown>0?`Try again in ${countdown}s`:'Create account'}</button>
  {state.error&&<div role="alert" className="auth-feedback auth-feedback-error"><strong>We couldn't complete this request.</strong><p>{state.error}</p>{state.reason==='rate_limit'&&<p>Please avoid repeated attempts while email delivery is restricted.</p>}</div>}
  {state.success&&<div role="status" className="auth-feedback auth-feedback-success"><strong>Check your email</strong><p>{state.success}</p><Link href="/login">Continue to sign in →</Link></div>}
  <p className="auth-field-help">By registering, you can securely set up a business workspace after verifying your email.</p>
 </form>;
}
