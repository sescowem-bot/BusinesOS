'use client';
import {useActionState,useEffect,useState} from 'react';
import Link from 'next/link';
import {ShieldCheck,ExternalLink} from 'lucide-react';
import {CookieSettingsButton} from '@/components/cookie-preferences';
import {signUp,type SignupState} from './actions';
import type {ActiveTerms} from '@/lib/server/legal-documents';

const initial:SignupState={error:'',success:'',retryAfterSeconds:0,reason:''};

export default function SignupForm({terms,available}:{terms:ActiveTerms|null;available:boolean}){
 const [state,action,pending]=useActionState(signUp,initial);
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
 const [countdown,setCountdown]=useState(0);
 const [password,setPassword]=useState('');
 const [accepted,setAccepted]=useState(false);
 useEffect(()=>{if(state.retryAfterSeconds>0)setCountdown(state.retryAfterSeconds)},[state]);
 useEffect(()=>{if(countdown<=0)return;const t=setTimeout(()=>setCountdown(x=>Math.max(0,x-1)),1000);return ()=>clearTimeout(t)},[countdown]);
 return <form action={action} className="auth-friendly-form">
  <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Your full name"/></div>
  <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" required maxLength={254} placeholder="you@example.com"/></div>
  <div className="field"><label htmlFor="password">Create password</label><div className="auth-password-wrap"><input id="password" name="password" type={showPassword?'text':'password'} required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} aria-describedby="password-guidance"/><button type="button" className="auth-password-toggle" onClick={()=>setShowPassword(x=>!x)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?'Hide':'Show'}</button></div><p className="auth-field-help" id="password-guidance">Use at least 12 characters. A longer, unique password is safer.</p></div>
  <div className="field"><label htmlFor="confirm_password">Confirm password</label><div className="auth-password-wrap"><input id="confirm_password" name="confirm_password" type={showConfirm?'text':'password'} required minLength={12} maxLength={128} autoComplete="new-password"/><button type="button" className="auth-password-toggle" onClick={()=>setShowConfirm(x=>!x)} aria-label={showConfirm?'Hide confirmation':'Show confirmation'} aria-pressed={showConfirm}>{showConfirm?'Hide':'Show'}</button></div></div>
  <section className="bo-legal-agreement" aria-labelledby="bo-legal-agreement-title">
   <div className="bo-legal-agreement-head"><ShieldCheck size={23} aria-hidden="true"/><div><strong id="bo-legal-agreement-title">Agreements &amp; privacy</strong><p>Review how BusinessOS works and how we handle personal information before creating your account.</p></div></div>
   <div className="bo-legal-links">
    <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service <ExternalLink size={12} aria-hidden="true"/></Link>
    <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice <ExternalLink size={12} aria-hidden="true"/></Link>
    <Link href="/cookies" target="_blank" rel="noopener noreferrer">Cookie Notice <ExternalLink size={12} aria-hidden="true"/></Link>
    <CookieSettingsButton className="bo-legal-cookies-link"/>
   </div>
   {terms?<>
    <input type="hidden" name="terms_document_id" value={terms.id}/>
    <label className="bo-legal-choice" htmlFor="bo-agree-terms"><input id="bo-agree-terms" name="accept_terms" type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I have read and agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link> (version {terms.version_label}).</span></label>
    <p className="bo-legal-small">This agreement is required to create a BusinessOS account. Marketing messages are not included in this agreement.</p>
   </>:<>
    <div className="bo-legal-pending" role="status"><strong>Terms under legal review.</strong> You can view the draft legal notices above. A binding acknowledgement is not requested until an approved version is published.</div>
    <label className="bo-legal-choice" aria-disabled="true"><input type="checkbox" disabled/><span>Agree to the approved Terms of Service <em>(available after review)</em></span></label>
    <p className="bo-legal-small">You may still create an account during this staged rollout. No Terms acceptance is recorded from an unapproved draft.</p>
   </>}
  </section>
  <button className="btn btn-primary auth-submit" disabled={!available||pending||countdown>0||password.length<12||Boolean(state.success)||(Boolean(terms)&&!accepted)}>{pending?'Creating your account…':countdown>0?`Try again in ${countdown}s`:'Create account'}</button>
  {state.error&&<div role="alert" className="auth-feedback auth-feedback-error"><strong>We couldn't complete this request.</strong><p>{state.error}</p>{state.reason==='rate_limit'&&<p>Please avoid repeated attempts while email delivery is restricted.</p>}</div>}
  {state.success&&<div role="status" className="auth-feedback auth-feedback-success"><strong>Check your email</strong><p>{state.success}</p><Link href="/login">Continue to sign in →</Link></div>}
  <p className="auth-field-help">Verify your email to continue setting up your BusinessOS workspace.</p>
 </form>;
}
