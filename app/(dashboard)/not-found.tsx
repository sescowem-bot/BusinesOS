import Link from 'next/link';
import '@/components/workspace-page-state.css';
export default function WorkspaceNotFound(){
 return <div className="bo-workspace-state" id="workspace-not-found" aria-labelledby="workspace-not-found-title">
  <section className="bo-workspace-state-card">
   <span className="bo-workspace-state-label">Page not found</span>
   <h1 id="workspace-not-found-title">We couldn't find that page</h1>
   <p>The address may be incorrect or the page may have moved. No business records have been changed by opening this link.</p>
   <div className="bo-workspace-state-actions"><Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link><Link href="/support" className="btn">Get help</Link></div>
  </section>
 </div>;
}
