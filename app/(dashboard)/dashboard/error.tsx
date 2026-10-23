'use client';
import Link from 'next/link';
import '@/components/workspace-page-state.css';
export default function DashboardError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <div className="bo-workspace-state" aria-labelledby="dashboard-error-title">
  <section className="bo-workspace-state-card" role="alert">
   <span className="bo-workspace-state-label">Dashboard unavailable</span>
   <h1 id="dashboard-error-title">Your dashboard couldn't load</h1>
   <p>We couldn't confirm your latest dashboard information. Please retry, or open your other workspace pages. Do not assume a payment or order was saved unless it appears in its register.</p>
   <div className="bo-workspace-state-actions"><button type="button" className="btn btn-primary" onClick={reset}>Try again</button><Link href="/orders" className="btn">View orders</Link><Link href="/support" className="btn">Get help</Link></div>
  </section>
 </div>;
}
