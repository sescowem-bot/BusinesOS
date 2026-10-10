'use client';
import Link from 'next/link';
import {useEffect} from 'react';
export default function AdminError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('Platform administration route error',error)},[error]);
 return <main className="admin-area" role="alert"><section className="card card-pad"><h1>Administration page unavailable</h1><p>The request could not be completed. Your platform settings have not been confirmed as changed.</p><p className="small muted">Contact your developer with this page URL{error.digest?` and reference ${error.digest}`:''} if the error continues.</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="btn btn-primary" onClick={reset}>Try again</button><Link href="/admin" className="btn">Administration centre</Link></div></section></main>;
}
