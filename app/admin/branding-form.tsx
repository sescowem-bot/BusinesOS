'use client';
import {useActionState} from 'react';
import {savePlatformBrand} from './actions';
import type {PlatformBrand} from '@/lib/server/branding';
export function BrandingForm({brand}:{brand:PlatformBrand}){
 const [state,action,pending]=useActionState(savePlatformBrand,{ok:false,message:''});
 return <form action={action} className="admin-form">
  <div className="admin-form-heading"><h2>Platform identity</h2><p>These settings affect the public website and platform branding, not individual business records.</p></div>
  <div className="form-grid">
   <Field name="name" label="Platform name" value={brand.name} required/>
   <Field name="short_name" label="Short name" value={brand.short_name} required/>
   <Field name="tagline" label="Tagline" value={brand.tagline}/>
   <Field name="support_email" label="Support email" value={brand.support_email} type="email"/>
   <Field name="support_phone" label="Support phone" value={brand.support_phone}/>
   <Field name="logo_url" label="Logo HTTPS URL" value={brand.logo_url} type="url"/>
   <Field name="favicon_url" label="Favicon HTTPS URL" value={brand.favicon_url} type="url"/>
   <Field name="primary_color" label="Primary brand colour" value={brand.primary_color} pattern="#[0-9a-fA-F]{6}"/>
   <Field name="accent_color" label="Accent colour" value={brand.accent_color} pattern="#[0-9a-fA-F]{6}"/>
   <div className="field full"><label htmlFor="description">Platform description</label><textarea id="description" name="description" defaultValue={brand.description} rows={4} maxLength={400}/></div>
  </div>
  <div className="admin-actions"><button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Saving…':'Save & publish'}</button><span className={state.ok?'positive':'negative'} role="status">{state.message}</span></div>
  <p className="small muted">Logo and favicon currently accept hosted HTTPS links. Media library uploads are planned for the next branding increment.</p>
 </form>
}
function Field({name,label,value,type='text',required=false,pattern}:{name:string;label:string;value:string;type?:string;required?:boolean;pattern?:string}){
 return <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={value} type={type} required={required} pattern={pattern} maxLength={1000}/></div>
}
