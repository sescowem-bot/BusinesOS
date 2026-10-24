'use client';
import {createContext,useContext} from 'react';
type Branding={logoUrl?:string;businessName?:string;platformName?:string};
const BrandContext=createContext<Branding>({});
export function WorkspaceLoadingBrandProvider({branding,children}:{branding:Branding;children:React.ReactNode}){
 return <BrandContext.Provider value={branding}>{children}</BrandContext.Provider>;
}
/** Quiet, nonblocking route placeholder. No timer, alarming timeout text or navigation reset. */
export function WorkspaceLoadingBrand({label='Loading page',mode='page'}:{label?:string;mode?:'page'|'workspace'|'section'}){
 const {logoUrl}=useContext(BrandContext);
 const safeLogo=logoUrl&&/^https:\/\//i.test(logoUrl)?logoUrl:null;
 return <div className={`bo-premium-loader bo-premium-loader--${mode} bo-quiet-loader`} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
  <span className="bo-premium-loader__symbol bo-quiet-loader__symbol" aria-hidden="true"><img src={safeLogo||'/app-icon-192.png'} alt="" width={26} height={26}/></span>
  <span className="bo-quiet-loader__track" aria-hidden="true"><span/></span>
 </div>;
}
