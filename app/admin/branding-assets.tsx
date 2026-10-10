'use client';
import {useActionState} from 'react';
import {uploadBrandAsset,type AssetUploadState} from './asset-actions';
import type {PlatformBrand} from '@/lib/server/branding';

const initial:AssetUploadState={ok:false,message:''};
function AssetForm({kind,url}:{kind:'logo'|'favicon';url:string}){
 const [state,action,pending]=useActionState(uploadBrandAsset,initial);
 const label=kind==='logo'?'Platform logo':'Website favicon';
 return <form action={action} className="brand-upload-panel">
  <div className="brand-upload-title"><strong>{label}</strong><span className="small muted">{kind==='logo'?'PNG, JPEG or WebP · up to 1.5 MB':'PNG, WebP or ICO · up to 512 KB'}</span></div>
  <div className="brand-upload-preview">{url?<img src={url} alt={`Current ${label.toLowerCase()}`} width={kind==='logo'?170:56} height={kind==='logo'?72:56} style={{objectFit:'contain',maxWidth:'100%'}}/>:<span className="muted small">No asset uploaded yet</span>}</div>
  <input type="hidden" name="asset_type" value={kind}/>
  <label className="field">Choose a new {kind}<input type="file" name="asset" required accept={kind==='logo'?'image/png,image/jpeg,image/webp':'image/png,image/webp,image/x-icon,.ico'}/></label>
  <button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Uploading…':`Upload ${kind}`}</button>
  {state.message&&<p role={state.ok?'status':'alert'} className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
export function BrandingAssets({brand}:{brand:PlatformBrand}){
 return <section className="brand-assets-card"><div><h2>Logo & favicon library</h2><p className="muted small">Upload each asset directly in System Owner. Your website, administration area and outbound email templates use the saved logo. Your browser tab uses the favicon.</p></div>
 <div className="brand-upload-grid"><AssetForm key={brand.logo_url||'no-logo'} kind="logo" url={brand.logo_url}/><AssetForm key={brand.favicon_url||'no-favicon'} kind="favicon" url={brand.favicon_url}/></div>
 <p className="small muted">These assets are public. Never upload confidential customer documents here. Brand changes may require refreshing an open tab.</p>
 </section>;
}
