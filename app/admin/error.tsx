'use client';
import Link from 'next/link';
export default function AdminError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main className="admin-area" role="alert"><section className="card card-pad"><h1>Administration page unavailable</h1><p>The request could not be completed. Your platform settings have not been confirmed as changed.</p><p className="small muted">If this continues, please contact support.</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="btn btn-primary" onClick={reset}>Try again</button><Link href="/admin" className="btn">Administration centre</Link></div></section></main>;
}
