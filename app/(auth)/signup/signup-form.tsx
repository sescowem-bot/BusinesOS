'use client';
import {useActionState} from 'react';
import {signUp} from './actions';
export default function SignupForm(){const [state,action,pending]=useActionState(signUp,{error:'',success:''});return <form action={action} style={{display:'grid',gap:14,marginTop:22}}>
 <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required minLength={2}/></div>
 <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required autoComplete="email"/></div>
 <div className="field"><label htmlFor="password">Password (12 characters minimum)</label><input id="password" name="password" type="password" required minLength={12} autoComplete="new-password"/></div>
 <button className="btn btn-primary" disabled={pending}>{pending?'Creating account…':'Create account'}</button>
 {state.error&&<p role="alert" className="negative small">{state.error}</p>}{state.success&&<p role="status" className="notice">{state.success}</p>}
 </form>}
