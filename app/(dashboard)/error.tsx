'use client';
import Link from 'next/link';
import '@/components/workspace-page-state.css';
export default function WorkspaceError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <div className="bo-workspace-state" aria-labelledby="workspace-error-title"><section className="bo-workspace-state-card" role="alert"><span className="bo-workspace-state-label">Workspace unavailable</span><h1 id="workspace-error-title">We couldn’t load this workspace page</h1><p>We couldn’t confirm the latest information. Please retry or open another page. Check the relevant register before repeating any financial action.</p><div className="bo-workspace-state-actions"><button type="button" className="btn btn-primary" onClick={reset}>Try again</button><Link className="btn" href="/dashboard">Dashboard</Link><Link className="btn" href="/support">Get help</Link></div></section></div>;
}
