'use client';
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <html lang="en"><body style={{fontFamily:'system-ui, sans-serif',margin:0,padding:24,background:'#f4f7fb',color:'#102b49',minHeight:'100vh',display:'grid',placeItems:'center'}}>
  <main role="alert" style={{maxWidth:560,background:'white',borderRadius:20,padding:32,border:'1px solid #dde6ec'}}><div style={{fontWeight:800,fontSize:22,color:'#123b63'}}>BusinessOS</div>
   <h1 style={{fontSize:28}}>We couldn't open BusinessOS</h1><p>Please try again in a moment. If this keeps happening, contact support.</p>
   <button type="button" style={{background:'#123b63',color:'white',border:0,borderRadius:10,padding:'12px 24px',fontWeight:700,cursor:'pointer'}} onClick={reset}>Try again</button>
  </main>
 </body></html>;
}
