'use client';
import {useActionState} from 'react';import {requestReset} from './actions';
export default function ForgotForm(){const [state,action,pending]=useActionState(requestReset,{message:''});return <form action={action} style={{display:'grid',gap:14,marginTop:22}}><div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required autoComplete="email"/></div><button className="btn btn-primary" disabled={pending}>Send reset link</button>{state.message&&<p role="status" className="notice">{state.message}</p>}</form>}
