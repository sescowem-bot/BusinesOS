'use client';

import {useState} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import {Activity, Bell, BookOpenText, Building2, ChevronRight, CreditCard, ExternalLink, Globe2, LayoutDashboard, LogOut, Mail, Menu, PanelTop, ShieldCheck, SlidersHorizontal, UserRound, Wallet, X} from 'lucide-react';
import {signOut} from '@/app/(auth)/login/actions';

type Branding = {name:string;short_name:string;logo_url:string};
type IconComponent = typeof LayoutDashboard;
type NavigationItem = {href:string;label:string;icon:IconComponent;exact?:boolean};
const navigation: {heading:string;items:NavigationItem[]}[] = [
 {heading:'CONTROL CENTRE',items:[{href:'/admin',label:'Overview',icon:LayoutDashboard,exact:true},{href:'/admin/notifications',label:'Notifications',icon:Bell},{href:'/admin/health',label:'System health',icon:Activity}]},
 {heading:'WEBSITE MANAGEMENT',items:[{href:'/admin/website',label:'Website overview',icon:Globe2},{href:'/admin/content',label:'Pages & content',icon:PanelTop},{href:'/admin/plans',label:'Pricing plans',icon:CreditCard},{href:'/admin/email',label:'Email templates',icon:Mail}]},
 {heading:'BUSINESS MANAGEMENT',items:[{href:'/admin/businesses',label:'Registered businesses',icon:Building2},{href:'/admin/upgrades',label:'Upgrade approvals',icon:ShieldCheck},{href:'/admin/plan-access',label:'Features & roles',icon:SlidersHorizontal}]},
 {heading:'MY WORKSPACE',items:[{href:'/admin/my-business',label:'My business',icon:Wallet},{href:'/',label:'Public website',icon:ExternalLink,exact:true}]},
];
function isSelected(path:string,item:NavigationItem){
 if(item.href==='/')return false;
 if(item.exact)return path===item.href;
 return path===item.href||path.startsWith(item.href+'/');
}
export function AdminWorkspace({children,brand,email,unreadCount}:{children:React.ReactNode;brand:Branding;email:string;unreadCount:number|null}){
 const path=usePathname();
 const [menuOpen,setMenuOpen]=useState(false);
 const segments=path.split('/').filter(Boolean);
 const currentLabel=navigation.flatMap(g=>g.items).find(i=>isSelected(path,i))?.label||'Administration';
 const handleClose=()=>setMenuOpen(false);
 return <div className="owner-console">
  {menuOpen&&<button className="owner-sidebar-backdrop" aria-label="Close navigation" onClick={handleClose}/>}
  <aside className={'owner-sidebar'+(menuOpen?' owner-sidebar-open':'')} aria-label="System Owner sidebar">
   <div className="owner-brand-row">
    <Link href="/admin" className="owner-brand" onClick={handleClose} aria-label={`${brand.name} System Owner home`}>
     {brand.logo_url?<img src={brand.logo_url} alt="" className="owner-brand-logo"/>:<span className="owner-brand-logo owner-logo-fallback"><ShieldCheck size={21}/></span>}
     <span className="owner-brand-copy"><strong>{brand.short_name||brand.name}</strong><small>System Owner</small></span>
    </Link>
    <button type="button" className="owner-mobile-close" aria-label="Close menu" onClick={handleClose}><X size={19}/></button>
   </div>
   <nav className="owner-sidebar-links" aria-label="Platform administration">
    {navigation.map(group=><div className="owner-nav-group" key={group.heading}>
     <p className="owner-nav-heading">{group.heading}</p>
     {group.items.map(item=>{const Icon=item.icon;const active=isSelected(path,item);return <Link href={item.href} key={item.href} onClick={handleClose} aria-current={active?'page':undefined} className={'owner-side-link'+(active?' is-active':'')}>
       <Icon aria-hidden="true" size={18} strokeWidth={1.9}/><span>{item.label}</span>
       {item.href==='/admin/notifications'&&unreadCount!==null&&unreadCount>0&&<em className="owner-nav-count">{unreadCount>99?'99+':unreadCount}</em>}
       {active&&<ChevronRight className="owner-active-chevron" aria-hidden="true" size={16}/>}
      </Link>})}
    </div>)}
   </nav>
   <div className="owner-sidebar-footer"><div className="owner-account-avatar"><UserRound size={17}/></div><div className="owner-account-info"><strong>Platform administrator</strong><small title={email}>{email}</small></div></div>
  </aside>
  <div className="owner-shell-body">
   <header className="owner-topbar">
    <div className="owner-topbar-start"><button className="owner-menu-toggle" aria-label="Open administration menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}><Menu size={22}/></button><span className="owner-breadcrumb">System Owner <ChevronRight size={15} aria-hidden="true"/> <strong>{currentLabel}</strong></span></div>
    <div className="owner-topbar-actions">
      <span className="owner-role-chip"><ShieldCheck size={14}/> Verified administrator</span>
      <Link href="/admin/notifications" aria-label={unreadCount?`${unreadCount} unread notifications`:'Notifications'} className="owner-icon-link"><Bell size={19}/>{unreadCount!==null&&unreadCount>0&&<span className="owner-bell-dot"/>}</Link>
      <Link href="/" className="owner-top-link"><ExternalLink size={16}/> Website</Link>
      <form action={signOut}><button type="submit" className="owner-signout"><LogOut size={16}/> <span>Sign out</span></button></form>
    </div>
   </header>
   <div className="owner-shell-content" data-admin-path={segments[1]||'overview'}>{children}</div>
   <footer className="owner-footer"><span>System Owner workspace</span><span>Administrator actions are permission-controlled and auditable where supported.</span></footer>
  </div>
 </div>;
}
