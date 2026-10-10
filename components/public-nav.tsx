'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {Menu,X,ArrowUpRight,ChevronDown} from 'lucide-react';
import type {ViewerAccess} from '@/lib/viewer-access';
const core=[{label:'Features',href:'/features'},{label:'Solutions',href:'/solutions'},{label:'How it works',href:'/how-it-works'},{label:'Pricing',href:'/pricing'}];
const company=[{label:'About us',href:'/about'},{label:'Resources',href:'/resources'},{label:'Contact',href:'/contact'}];
export default function PublicNav({name,logo,access='guest'}:{name:string;logo?:string;access?:ViewerAccess}){
 const [open,setOpen]=useState(false);
 const pathname=usePathname();
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[open]);
 const quick=access==='admin'?{label:'System Owner',href:'/admin'}:access==='business'?{label:'Your workspace',href:'/dashboard'}:access==='onboarding'?{label:'Complete setup',href:'/onboarding'}:{label:'Get started',href:'/signup'};
 return <><a href="#site-main" className="site-skip">Skip to main content</a><header className="public-header"><div className="marketing-container public-nav"><Link href="/" className="public-logo" aria-label={`${name} homepage`} onClick={()=>setOpen(false)}>{logo?<img src={logo} alt="" width={37} height={37}/>:<span className="public-logo-mark">{name.slice(0,1).toUpperCase()}</span>}<strong>{name}</strong></Link>
 <nav className="public-nav-links" aria-label="Main navigation">{core.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href?'page':undefined}>{link.label}</Link>)}<div className="public-more"><button type="button" className="public-more-trigger" aria-haspopup="true">Company <ChevronDown size={14}/></button><div className="public-more-menu">{company.map(link=><Link href={link.href} key={link.href} aria-current={pathname===link.href?'page':undefined}>{link.label}</Link>)}</div></div></nav>
 <div className="public-nav-actions">{access==='guest'?<Link href="/login" className="public-signin">Sign in</Link>:null}<Link href={quick.href} className="public-cta">{quick.label}<ArrowUpRight size={16}/></Link>{access==='admin'?<Link href="/admin/my-business" className="public-admin-icon" title="Open your business workspace">My Business</Link>:null}{access!=='guest'&&<Link href="/logout" className="public-signin">Sign out</Link>}</div>
 <button className="public-menu-button" type="button" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="public-menu" onClick={()=>setOpen(v=>!v)}>{open?<X size={23}/>:<Menu size={23}/>}</button></div>
 {open&&<nav id="public-menu" className="public-mobile-menu" aria-label="Mobile navigation">{[...core,...company].map(link=><Link onClick={()=>setOpen(false)} href={link.href} key={link.href} aria-current={pathname===link.href?'page':undefined}>{link.label}</Link>)}{access==='admin'&&<><Link href="/admin/website" onClick={()=>setOpen(false)}>Manage website</Link><Link href="/admin/businesses" onClick={()=>setOpen(false)}>Manage businesses</Link><Link href="/admin/my-business" onClick={()=>setOpen(false)}>My Business</Link></>}{access==='guest'&&<Link href="/login" onClick={()=>setOpen(false)}>Sign in</Link>}<Link className="public-cta" href={quick.href} onClick={()=>setOpen(false)}>{quick.label}<ArrowUpRight size={16}/></Link>{access!=='guest'&&<Link href="/logout" onClick={()=>setOpen(false)}>Sign out</Link>}</nav>}</header></>
}
