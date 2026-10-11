'use client';
import Link from 'next/link';
export default function AppError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main className="tax-page" role="alert" style={{minHeight:'70vh',display:'grid',placeItems:'center',padding:24}}>
  <section className="tax-panel" style={{maxWidth:580,width:'100%'}}>
   <h1>We couldn't open this page</h1>
   <p>Something interrupted this request. Please try again. Your recent changes have not been confirmed.</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:12}}><button type="button" className="btn btn-primary" onClick={reset}>Try again</button><Link href="/" className="btn">Go to home</Link><Link href="/support">Get help</Link></div>
  </section>
 </main>;
}
