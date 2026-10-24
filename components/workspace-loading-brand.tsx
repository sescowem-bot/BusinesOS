'use client';
import {createContext,useContext} from 'react';
type Branding={logoUrl?:string;businessName?:string;platformName?:string};
const BrandContext=createContext<Branding>({});
/** Brand details come from the existing workspace layout, without extra network calls. */
export function WorkspaceLoadingBrandProvider({branding,children}:{branding:Branding;children:React.ReactNode}){
 return <BrandContext.Provider value={branding}>{children}</BrandContext.Provider>;
}
/** Restore the existing BusinessOS branded ring, name and progress message.
 * A slow network does not automatically mean failure: no timed retry buttons.
 */
export function WorkspaceLoadingBrand({label='Opening page',mode='page'}:{label?:string;mode?:'page'|'workspace'|'section'}){
 const {logoUrl,businessName,platformName}=useContext(BrandContext);
 const safeLogo=logoUrl&&/^https:\/\//i.test(logoUrl)?logoUrl:null;
 const name=businessName||platformName||'BusinessOS';
 return <section className={`bo-premium-loader bo-premium-loader--${mode}`} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
  <div className="bo-premium-loader__animation" aria-hidden="true">
   <span className="bo-premium-loader__ring"/>
   <span className="bo-premium-loader__symbol"><img src={safeLogo||'/app-icon-192.png'} alt="" width={54} height={54} loading="eager" referrerPolicy="no-referrer"/></span>
  </div>
  <strong className="bo-premium-loader__name">{name}</strong>
  <p className="bo-premium-loader__label">{label}…</p>
 </section>;
}
