'use client';

import {useActionState,useState} from 'react';
import type {CSSProperties} from 'react';
import {savePlatformBrand} from './actions';
import type {PlatformBrand} from '@/lib/server/branding';

const palettes=[
 {name:'Business blue',primary:'#123B63',accent:'#16845B'},
 {name:'Royal blue',primary:'#1D4ED8',accent:'#0F766E'},
 {name:'Midnight',primary:'#172554',accent:'#64748B'},
 {name:'Teal',primary:'#115E59',accent:'#2563EB'},
] as const;
const hex=/^#[0-9a-fA-F]{6}$/;
function contrastWhite(value:string){
 if(!hex.test(value))return 0;
 const rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);
 const linear=rgb.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 return 1.05/(.2126*linear[0]+.7152*linear[1]+.0722*linear[2]+.05);
}

export function BrandingForm({brand}:{brand:PlatformBrand}){
 const [state,action,pending]=useActionState(savePlatformBrand,{ok:false,message:''});
 const [primary,setPrimary]=useState(brand.primary_color);
 const [accent,setAccent]=useState(brand.accent_color);
 const [name,setName]=useState(brand.name);
 const [tagline,setTagline]=useState(brand.tagline);
 const primaryValid=hex.test(primary)&&contrastWhite(primary)>=4.5,accentValid=hex.test(accent)&&contrastWhite(accent)>=4.5;
 const draftChanged=primary.toUpperCase()!==brand.primary_color.toUpperCase()||accent.toUpperCase()!==brand.accent_color.toUpperCase();
 const swatchStyle={'--bo-preview-primary':primaryValid?primary:'#123B63','--bo-preview-accent':accentValid?accent:'#16845B'} as CSSProperties;
 return <form action={action} className="admin-form bo-brand-form">
  <div className="admin-form-heading"><h2>Brand &amp; appearance</h2><p>Choose your platform identity and theme. You can preview colours before publishing them to BusinessOS. Customer business logos remain separate.</p></div>
  <div className="bo-brand-form-layout">
   <div className="bo-brand-form-fields">
    <div className="form-grid">
     <Field name="name" label="Platform name" value={name} onChange={setName} required/>
     <Field name="short_name" label="Short name" value={brand.short_name} required/>
     <Field name="tagline" label="Tagline" value={tagline} onChange={setTagline}/>
     <Field name="support_email" label="Support email" value={brand.support_email} type="email"/>
     <Field name="support_phone" label="WhatsApp and support number" value={brand.support_phone} placeholder="e.g. +2348012345678"/>
     <div className="field full"><label htmlFor="description">Platform description</label><textarea id="description" name="description" defaultValue={brand.description} rows={3} maxLength={400}/></div>
    </div>
    <section className="bo-brand-palette" aria-label="Choose a colour palette">
     <h3>Quick colour palettes</h3>
     <p className="small muted">Select a palette or choose your own colours below.</p>
     <div className="bo-brand-preset-grid">{palettes.map(p=>{
      const selected=primary.toUpperCase()===p.primary.toUpperCase()&&accent.toUpperCase()===p.accent.toUpperCase();
      return <button key={p.name} type="button" aria-pressed={selected} className={'bo-brand-preset'+(selected?' is-selected':'')} onClick={()=>{setPrimary(p.primary);setAccent(p.accent)}}>
       <span className="bo-brand-preset-swatches"><i style={{background:p.primary}}/><i style={{background:p.accent}}/></span><span>{p.name}</span>{selected&&<span className="bo-brand-selected">Selected</span>}
      </button>;
     })}</div>
    </section>
    <div className="bo-brand-colour-grid">
     <ColourField id="primary_color" label="Primary colour" value={primary} onChange={setPrimary}/>
     <ColourField id="accent_color" label="Accent colour" value={accent} onChange={setAccent}/>
    </div>
   </div>
   <aside className="bo-brand-live-preview" aria-label="Live theme preview" style={swatchStyle}>
    <div className="bo-brand-preview-header"><span className="bo-brand-preview-indicator"/> LIVE PREVIEW</div>
    <div className="bo-brand-preview-shell">
     <div className="bo-brand-preview-nav"><span className="bo-brand-preview-monogram">{(name||'B').slice(0,1).toUpperCase()}</span><strong>{name||'BusinessOS'}</strong></div>
     <div className="bo-brand-preview-content"><span className="bo-brand-preview-overline">YOUR WORKSPACE</span><h3>Welcome back</h3><p>{tagline||'Run your business. Stay in control.'}</p>
      <div className="bo-brand-preview-tiles"><div><small>Revenue</small><strong>₦245,000</strong></div><div><small>Active orders</small><strong>12</strong></div></div>
      <span className="bo-brand-preview-button">Primary action</span><span className="bo-brand-preview-accent">● Success indicator</span>
     </div>
    </div>
    <p className="small">Preview only. Some surfaces use neutral colours for readability; invoice branding and individual business settings are managed separately.</p>
   </aside>
  </div>
  <div className="admin-actions bo-brand-save"><button className="btn btn-primary" type="submit" disabled={pending||!primaryValid||!accentValid}>{pending?'Publishing…':'Save & publish changes'}</button><span aria-live="polite" className={state.ok?'positive':'negative'} role="status">{state.message|| (draftChanged?'Colour changes have not been published.':'Current colours are loaded.')}</span></div>
  <p className="small muted">The selected theme is stored in the existing platform branding settings. A publish refreshes the application cache. Installed app icons may remain cached by the phone or browser until refreshed or reinstalled.</p>
 </form>;
}
function ColourField({id,label,value,onChange}:{id:'primary_color'|'accent_color';label:string;value:string;onChange:(v:string)=>void}){
 const valid=hex.test(value)&&contrastWhite(value)>=4.5;
 return <div className="field bo-brand-colour-field"><label htmlFor={id}>{label}</label><div className="bo-brand-colour-input">
  <input type="color" aria-label={'Pick '+label.toLowerCase()} value={hex.test(value)?value:'#123B63'} onChange={e=>onChange(e.target.value)}/>
  <input id={id} name={id} value={value} onChange={e=>onChange(e.target.value)} required pattern="#[0-9a-fA-F]{6}" maxLength={7} aria-invalid={!valid} aria-describedby={id+'-hint'} spellCheck={false}/>
 </div><span id={id+'-hint'} className={'small '+(!valid?'negative':'muted')}>{valid?'Readable colour (4.5:1 contrast on white)':'Use a dark six-digit hex colour, e.g. #123B63'}</span></div>;
}
function Field({name,label,value,type='text',required=false,placeholder,onChange}:{name:string;label:string;value:string;type?:string;required?:boolean;placeholder?:string;onChange?:(v:string)=>void}){
 return <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} {...(onChange?{value,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onChange(e.target.value)}:{defaultValue:value})} type={type} required={required} placeholder={placeholder} maxLength={1000}/></div>;
}
