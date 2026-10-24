'use client';
import {useActionState,useEffect,useState} from 'react';
import Link from 'next/link';
import {ShieldCheck} from 'lucide-react';
import {signUp,type SignupState} from './actions';
import type {ActiveTerms} from '@/lib/server/legal-documents';

const initial:SignupState={error:'',success:'',retryAfterSeconds:0,reason:''};

export default function SignupForm({terms,available,selectedPlan=null}:{terms:ActiveTerms|null;available:boolean;selectedPlan?:string|null}){
 const [state,action,pending]=useActionState(signUp,initial);
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
 const [countdown,setCountdown]=useState(0);
 const [password,setPassword]=useState('');
 const [accepted,setAccepted]=useState(false);
 useEffect(()=>{if(state.retryAfterSeconds>0)setCountdown(state.retryAfterSeconds)},[state]);
 useEffect(()=>{if(countdown<=0)return;const t=setTimeout(()=>setCountdown(x=>Math.max(0,x-1)),1000);return ()=>clearTimeout(t)},[countdown]);
 return <form action={action} className="auth-friendly-form"><input type="hidden" name="selected_plan" value={selectedPlan||''}/>
  <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Your full name"/></div>
  <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" required maxLength={254} placeholder="you@example.com"/></div>
  <div className="field"><label htmlFor="password">Create password</label><div className="auth-password-wrap"><input id="password" name="password" type={showPassword?'text':'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} aria-describedby="password-guidance"/><button type="button" className="auth-password-toggle" onClick={()=>setShowPassword(x=>!x)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?'Hide':'Show'}</button></div><p className="auth-field-help" id="password-guidance">Choose a password with at least 8 characters. A unique phrase that's easy to remember works well.</p><div className="bo-password-progress" aria-label="Password length progress"><span style={{width:`${Math.min(100,password.length/8*100)}%`}}/></div><p className="auth-field-help" aria-live="polite">{password.length>=8?'Good length. Choose a password you have not used elsewhere.':`${8-password.length} more characters needed.`}</p></div>
  <div className="field"><label htmlFor="confirm_password">Confirm password</label><div className="auth-password-wrap"><input id="confirm_password" name="confirm_password" type={showConfirm?'text':'password'} required minLength={8} maxLength={128} autoComplete="new-password"/><button type="button" className="auth-password-toggle" onClick={()=>setShowConfirm(x=>!x)} aria-label={showConfirm?'Hide confirmation':'Show confirmation'} aria-pressed={showConfirm}>{showConfirm?'Hide':'Show'}</button></div></div>
  <section className="bo-legal-agreement" aria-labelledby="bo-legal-agreement-title">
   <div className="bo-legal-agreement-head"><ShieldCheck size={21} aria-hidden="true"/><div><strong id="bo-legal-agreement-title">Agreement &amp; privacy</strong><p>Review the terms and privacy information before registering.</p></div></div>
   <p className="bo-legal-small"><Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link> · <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</Link></p>
   <input type="hidden" name="terms_document_id" value={terms?.id||''}/>
   <label className="bo-legal-choice" htmlFor="bo-agree-terms"><input id="bo-agree-terms" name="accept_terms" type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>
   <span>{terms?<>I agree to the Terms of Service and acknowledge the Privacy Notice.</>:<>I have reviewed the available Terms information and Privacy Notice.</>}</span></label>
  </section>
  <button className="btn btn-primary auth-submit" disabled={!available||pending||countdown>0||password.length<8||Boolean(state.success)||!accepted}>{pending?'Creating your account…':countdown>0?`Try again in ${countdown}s`:'Create account'}</button>
  {state.error&&<div role="alert" className="auth-feedback auth-feedback-error"><strong>We couldn't create your account</strong><p>{state.error}</p>{state.reason==='rate_limit'&&<p>Please avoid repeated attempts while email delivery is restricted.</p>}</div>}
  {state.success&&<div role="status" className="auth-feedback auth-feedback-success"><strong>Check your email to activate your account</strong><p>{state.success}</p><Link href="/login">Already confirmed? Sign in →</Link></div>}
  <p className="auth-field-help">Verify your email to continue setting up your BusinessOS workspace.</p>
 </form>;
}
