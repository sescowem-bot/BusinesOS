/** Rendered immediately while the server verifies identity and loads workspace data. */
export default function BusinessWorkspaceLoading(){
 return <main className="bo-performance-loading" role="status" aria-live="polite" aria-label="Opening secure business workspace">
  <div className="bo-performance-loading-inner">
   <div className="bo-performance-loading-heading"><span className="bo-performance-loading-mark" aria-hidden="true"/><div><strong>Opening your workspace</strong><p>Checking access and loading your latest records…</p></div></div>
   <div className="bo-performance-loading-bars" aria-hidden="true"><i/><i/><i/><i/></div>
   <p className="small muted">Your business records remain private while the workspace loads.</p>
  </div>
 </main>;
}
