'use client';
import {useActionState,useEffect,useState} from 'react';
import {signIn,type LoginState} from './actions';
import Link from 'next/link';
const initial:LoginState={error:'',retryAfterSeconds:0,reason:''};
export default function LoginForm(){
 const [state,action,pending]=useActionState(signIn,initial);
 const [showPassword,setShowPassword]=useState(false);
 const [countdown,setCountdown]=useState(0);
 useEffect(()=>{if(state.retryAfterSeconds>0)setCountdown(state.retryAfterSeconds)},[state]);
 useEffect(()=>{if(countdown<=0)return;const t=setTimeout(()=>setCountdown(n=>Math.max(0,n-1)),1000);return ()=>clearTimeout(t)},[countdown]);
 return <form action={action} className="auth-friendly-form">
   <div className="field"><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" required placeholder="you@example.com"/></div>
   <div className="field"><div className="auth-label-row"><label htmlFor="login-password">Password</label><Link href="/forgot-password">Forgot password?</Link></div><div className="auth-password-wrap"><input id="login-password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" required/><button type="button" className="auth-password-toggle" onClick={()=>setShowPassword(x=>!x)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?'Hide':'Show'}</button></div></div>
   <button className="btn btn-primary auth-submit" type="submit" disabled={pending||countdown>0}>{pending?'Signing you in…':countdown>0?`Try again in ${countdown}s`:'Sign in'}</button>
   {state.error&&<div role="alert" className="auth-feedback auth-feedback-error"><strong>Unable to sign in</strong><p>{state.error}</p>{state.reason==='unconfirmed'&&<p>Check your inbox and Spam/Junk folder for the confirmation email.</p>}</div>}
   <p className="auth-field-help">New to BusinessOS? <Link href="/signup">Create a business account</Link>.</p>
 </form>;
}
