'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Menu,X,ArrowUpRight} from 'lucide-react';
export default function PublicNav({name,logo}:{name:string;logo?:string}){
 const [open,setOpen]=useState(false);
 const links=[{label:'Features',href:'#features'},{label:'Solutions',href:'#solutions'},{label:'How it works',href:'#how-it-works'},{label:'Why us',href:'#why-us'},{label:'FAQs',href:'#faqs'}];
 return <header className="public-header"><div className="marketing-container public-nav"><Link href="/" className="public-logo" aria-label={`${name} home`}>{logo?<img src={logo} alt="" width={36} height={36}/>:<span className="public-logo-mark">{name.slice(0,1).toUpperCase()}</span>}<strong>{name}</strong></Link><nav className="public-nav-links" aria-label="Main navigation">{links.map(x=><a href={x.href} key={x.href}>{x.label}</a>)}</nav><div className="public-nav-actions"><Link href="/login" className="public-signin">Log in</Link><Link href="/signup" className="public-cta">Get started <ArrowUpRight size={15}/></Link></div><button className="public-menu-button" type="button" aria-label={open?'Close menu':'Open menu'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X size={23}/>:<Menu size={23}/>}</button></div>{open&&<nav className="public-mobile-menu" aria-label="Mobile navigation">{links.map(x=><a onClick={()=>setOpen(false)} href={x.href} key={x.href}>{x.label}</a>)}<Link onClick={()=>setOpen(false)} href="/login">Log in</Link><Link onClick={()=>setOpen(false)} className="public-cta" href="/signup">Get started</Link></nav>}</header>
}
