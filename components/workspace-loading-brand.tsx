'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import Link from 'next/link';

type Branding={logoUrl?:string;businessName?:string;platformName?:string};
const BrandContext=createContext<Branding>({});
/** Branding is provided by the existing authenticated shell query; no new network request. */
export function WorkspaceLoadingBrandProvider({branding,children}:{branding:Branding;children:React.ReactNode}){
 return <BrandContext.Provider value={branding}>{children}</BrandContext.Provider>;
}
/** Both initial route transitions and nested workspace pages use the same low-cost loader. */
export function WorkspaceLoadingBrand({label='Loading page',mode='page'}:{label?:string;mode?:'page'|'workspace'|'section'}){
 const {logoUrl,businessName,platformName}=useContext(BrandContext);
 const [waiting,setWaiting]=useState(false);
 useEffect(()=>{
  const id=window.setTimeout(()=>setWaiting(true),10000);
  return()=>window.clearTimeout(id);
 },[label]);
 const safeLogo=logoUrl&&/^https:\/\//i.test(logoUrl)?logoUrl:null;
 const title=businessName||platformName||'BusinessOS';
 return <section className={`bo-premium-loader bo-premium-loader--${mode}`} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
  <div className="bo-premium-loader__animation" aria-hidden="true">
   <span className="bo-premium-loader__ring"/>
   <span className="bo-premium-loader__symbol">{safeLogo?<img src={safeLogo} alt="" width={54} height={54} loading="eager" referrerPolicy="no-referrer"/>:<img src="/app-icon-192.png" alt="" width={54} height={54} loading="eager"/>}</span>
  </div>
  <strong className="bo-premium-loader__name">{title}</strong>
  <p className="bo-premium-loader__label">{label}…</p>
  {waiting&&<div className="bo-premium-loader__slow" role="status">
   <p>This is taking longer than expected. Your connection or the server may be busy.</p>
   <div className="bo-premium-loader__actions"><button type="button" onClick={()=>window.location.reload()}>Retry page</button><Link href="/support" prefetch={false}>Get support</Link></div>
  </div>}
 </section>;
}
