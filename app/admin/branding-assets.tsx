'use client';
import {useActionState} from 'react';
import {uploadBrandAsset,type AssetUploadState} from './asset-actions';
import type {PlatformBrand} from '@/lib/server/branding';
import {brandIconPath} from '@/lib/brand-icons';

const initial:AssetUploadState={ok:false,message:''};
function AssetForm({kind,url,fallback}:{kind:'logo'|'favicon';url:string;fallback?:string}){
 const [state,action,pending]=useActionState(uploadBrandAsset,initial);
 const label=kind==='logo'?'Platform logo':'Website favicon';
 return <form action={action} className="brand-upload-panel">
  <div className="brand-upload-title"><strong>{label}</strong><span className="small muted">{kind==='logo'?'PNG, JPEG or WebP · up to 1.5 MB':'PNG, WebP or ICO · up to 512 KB'}</span></div>
  <div className="brand-upload-preview">{url?<img src={url} alt={`Current ${label.toLowerCase()}`} width={kind==='logo'?170:56} height={kind==='logo'?72:56} style={{objectFit:'contain',maxWidth:'100%'}}/>:fallback?<img src={fallback} alt="Current generated icon preview" width={56} height={56} style={{objectFit:'contain'}}/>:<span className="muted small">No asset uploaded yet</span>}</div>
  <input type="hidden" name="asset_type" value={kind}/>
  <label className="field">Choose a new {kind}<input type="file" name="asset" required accept={kind==='logo'?'image/png,image/jpeg,image/webp':'image/png,image/webp,image/x-icon,.ico'}/></label>
  <button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Uploading…':`Upload ${kind}`}</button>
  {state.message&&<p role={state.ok?'status':'alert'} className={state.ok?'positive':'negative'}>{state.message}</p>}
 </form>;
}
export function BrandingAssets({brand}:{brand:PlatformBrand}){
 return <section className="brand-assets-card"><div><h2>Logo & favicon library</h2><p className="muted small">Upload your platform logo first. Until you upload a separate square favicon, the system will use that logo for browser tabs and installable app icons. Without either file, an icon is generated from your saved platform name and colours.</p></div>
 <div className="brand-upload-grid"><AssetForm key={brand.logo_url||'no-logo'} kind="logo" url={brand.logo_url}/><AssetForm key={brand.favicon_url||'no-favicon'} kind="favicon" url={brand.favicon_url} fallback={brandIconPath(brand,64)}/></div>
 <p className="small muted">Use a square PNG or WebP favicon for the clearest small-tab display (recommended 512 × 512 px). A separate favicon overrides the logo. Browser and installed-app icons may take a refresh or reinstall to update after upload. Never upload customer information here.</p>
 </section>;
}
