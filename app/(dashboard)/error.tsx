'use client';
import Link from 'next/link';
import {useEffect} from 'react';
export default function WorkspaceError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('Workspace route error',error)},[error]);
 return <main className="tax-page" role="alert"><section className="tax-panel"><h1>We couldn’t load this workspace page</h1><p>There may be a temporary database or permission problem. No changes have been confirmed by this screen.</p><p className="small muted">If this continues, contact platform support with the page URL{error.digest?` and reference ${error.digest}`:''}.</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="btn btn-primary" onClick={reset}>Try again</button><Link className="btn" href="/dashboard">Back to dashboard</Link></div></section></main>;
}
