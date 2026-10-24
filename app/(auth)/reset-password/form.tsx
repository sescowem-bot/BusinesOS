'use client';
import {useActionState,useState} from 'react';
import {changePassword} from './actions';
export default function PasswordForm(){
 const [state,action,pending]=useActionState(changePassword,{message:''});
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
 return <form action={action} className="auth-friendly-form">
  <div className="field"><label htmlFor="password">New password</label><div className="auth-password-wrap"><input id="password" name="password" type={showPassword?'text':'password'} minLength={8} maxLength={128} autoComplete="new-password" required/><button type="button" className="auth-password-toggle" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Hide':'Show'}</button></div><p className="auth-field-help">Use at least 8 characters. A unique phrase is a good choice.</p></div>
  <div className="field"><label htmlFor="password_confirm">Confirm new password</label><div className="auth-password-wrap"><input id="password_confirm" name="password_confirm" type={showConfirm?'text':'password'} minLength={8} maxLength={128} autoComplete="new-password" required/><button type="button" className="auth-password-toggle" onClick={()=>setShowConfirm(v=>!v)}>{showConfirm?'Hide':'Show'}</button></div></div>
  <button className="btn btn-primary auth-submit" disabled={pending}>{pending?'Updating…':'Update password'}</button>
  {state.message&&<p role="status" className="notice">{state.message}</p>}
 </form>;
}
