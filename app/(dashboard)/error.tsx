'use client';
import Link from 'next/link';
export default function WorkspaceError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main className="tax-page" role="alert"><section className="tax-panel"><h1>We couldn’t load this workspace page</h1><p>This page is temporarily unavailable. Please try again. Any changes you were making have not been confirmed.</p><p className="small muted">If this keeps happening, please contact support and tell us which page you were trying to open.</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="btn btn-primary" onClick={reset}>Try again</button><Link className="btn" href="/dashboard">Back to dashboard</Link></div></section></main>;
}
