'use client';
import {useActionState} from 'react';
import {signIn} from './actions';
import Link from 'next/link';
export default function LoginForm(){
 const [state,action,pending]=useActionState(signIn,{error:''});
 return <form action={action} style={{display:'grid',gap:14,marginTop:22}}>
   <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></div>
   <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required/></div>
   <button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Signing in…':'Sign in'}</button>
   {state.error&&<p className="small negative" role="alert">{state.error}</p>}
 </form>
}
