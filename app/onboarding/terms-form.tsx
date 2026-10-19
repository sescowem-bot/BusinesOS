'use client';
import Link from 'next/link';
import {useActionState,useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {acceptOnboardingTerms,type TermsAcceptanceState} from './terms-actions';
import type {ActiveTerms} from '@/lib/server/legal-documents';
const initial:TermsAcceptanceState={ok:false,message:''};
export default function TermsAcknowledgement({terms}:{terms:ActiveTerms}){
 const [state,action,pending]=useActionState(acceptOnboardingTerms,initial);
 const router=useRouter();
 useEffect(()=>{if(state.ok)router.refresh()},[state.ok,router]);
 return <form action={action} className="auth-friendly-form">
  <p>Before setting up your workspace, please read the currently approved <Link href="/terms" target="_blank">Terms of Service (version {terms.version_label})</Link> and <Link href="/privacy" target="_blank">Privacy Notice</Link>.</p>
  <input type="hidden" name="terms_id" value={terms.id}/>
  <label className="cms-check"><input type="checkbox" name="agree_terms" required/> I have read and agree to the current Terms of Service.</label>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Recording agreement…':'Accept and continue'}</button>
  {state.message&&<p role="status" className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
