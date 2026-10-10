'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {PlatformBrand} from '@/lib/server/branding';
import {Activity,BarChart3,Bell,BriefcaseBusiness,Building2,Calculator,ChevronRight,ClipboardList,CreditCard,FileText,Home,LayoutDashboard,LogOut,Menu,Package,Receipt,Search,Settings,Store,Target,Users,Wallet,Warehouse,Handshake,ShieldCheck} from './icons';

type NavigationItem={label:string;href:string;icon:typeof LayoutDashboard};
type NavigationGroup={title:string;items:NavigationItem[]};
const groups:NavigationGroup[]=[
 {title:'Overview',items:[{label:'Dashboard',href:'/dashboard',icon:LayoutDashboard},{label:'Getting started',href:'/getting-started',icon:ClipboardList},{label:'Notifications',href:'/notifications',icon:Bell}]},
 {title:'Sales & customers',items:[{label:'Customers',href:'/customers',icon:Users},{label:'Orders & sales',href:'/orders',icon:ClipboardList},{label:'Retail POS',href:'/pos',icon:Store},{label:'Wholesale pricing',href:'/wholesale',icon:Package},{label:'Cashier shifts',href:'/pos/shifts',icon:Wallet},{label:'Returns & credit notes',href:'/returns',icon:Receipt},{label:'Products & services',href:'/products',icon:Package},{label:'Quotes',href:'/quotes',icon:FileText},{label:'Invoices',href:'/invoices',icon:Receipt},{label:'Payments',href:'/payments',icon:CreditCard}]},
 {title:'Operations',items:[{label:'Expenses',href:'/expenses',icon:Wallet},{label:'Inventory',href:'/inventory',icon:Warehouse},{label:'Branch stock & transfers',href:'/inventory/locations',icon:Warehouse},{label:'Suppliers & purchasing',href:'/purchasing',icon:Package},{label:'Tasks',href:'/tasks',icon:Target},{label:'Automation requests',href:'/automations/requests',icon:Target},{label:'Team & branches',href:'/team',icon:Users}]},
 {title:'Finance & compliance',items:[{label:'Accounting',href:'/accounting',icon:Calculator},{label:'Financial reports',href:'/reports',icon:BarChart3},{label:'Retail performance',href:'/retail-reports',icon:BarChart3},{label:'Tax Centre',href:'/tax-centre',icon:Calculator},{label:'Tax Compliance',href:'/tax-compliance',icon:ShieldCheck},{label:'Tax Discovery',href:'/tax-profile',icon:FileText}]},
 {title:'Engagement & growth',items:[{label:'Communications',href:'/communications',icon:Users},{label:'Campaigns',href:'/campaigns',icon:Target},{label:'Insights',href:'/insights',icon:Activity},{label:'Growth Centre',href:'/growth',icon:BriefcaseBusiness},{label:'Marketplace',href:'/marketplace',icon:Store},{label:'Partners',href:'/partners',icon:Handshake}]},
 {title:'Workspace',items:[{label:'Plans & upgrades',href:'/upgrade',icon:CreditCard},{label:'Help & support',href:'/support',icon:ShieldCheck},{label:'Settings',href:'/settings',icon:Settings}]}
];
const ownerLinks:NavigationItem[]=[
 {label:'Admin Console',href:'/admin',icon:ShieldCheck},
 {label:'Manage website',href:'/admin/website',icon:Home},
 {label:'Manage businesses',href:'/admin/businesses',icon:Building2},{label:'Support & roles',href:'/admin/support',icon:ShieldCheck},
 {label:'Manage plans and pricing',href:'/admin/plans',icon:CreditCard},{label:'Automation service requests',href:'/admin/automations',icon:Target},
 {label:'Pilot readiness',href:'/admin/pilot',icon:ShieldCheck},
 {label:'Switch my business',href:'/admin/my-business',icon:BriefcaseBusiness}
];
const allItems=groups.flatMap(g=>g.items);
const selected=(path:string,href:string)=>path===href||(href!=='/admin'&&href!=='/dashboard'&&path.startsWith(href+'/'));

function NavigationItems({path,isPlatformAdmin,unreadCount,onNavigate,filter}:{path:string;isPlatformAdmin:boolean;unreadCount:number;onNavigate:()=>void;filter:string}){
 const term=filter.trim().toLocaleLowerCase();
 const visibleGroups=[...(isPlatformAdmin?[{title:'Platform administration',items:ownerLinks}]:[]),...groups]
  .map(group=>({...group,items:group.items.filter(item=>!term||`${item.label} ${group.title}`.toLocaleLowerCase().includes(term))}))
  .filter(group=>group.items.length>0);
 return <>
 {visibleGroups.map(group=><section className="work-nav-group" key={group.title} aria-label={group.title}>
   <div className="work-nav-heading">{group.title}</div>
   {group.items.map(({label,href,icon:Icon})=>{
     const active=selected(path,href);
     return <Link key={href} onClick={onNavigate} href={href} className={'work-nav-link'+(active?' active':'')} aria-current={active?'page':undefined}>
       <Icon size={18} aria-hidden="true"/><span>{label}</span>
       {href==='/notifications'&&unreadCount>0&&<span className="work-nav-count">{unreadCount>99?'99+':unreadCount}</span>}
     </Link>;
   })}
 </section>)}
 {visibleGroups.length===0&&<p className="work-nav-no-results">No matching page. Try searching for orders, inventory, finance or admin.</p>}
 </>;
}

export function Shell({children,brand,businessRole,businessName,unreadCount=0,isPlatformAdmin=false}:{children:React.ReactNode;brand?:Pick<PlatformBrand,'name'|'short_name'|'logo_url'>;businessRole?:string;businessName?:string;unreadCount?:number;isPlatformAdmin?:boolean}){
 const path=usePathname();
 const [drawerOpen,setDrawerOpen]=useState(false);
 const [navSearch,setNavSearch]=useState('');
 const closeButton=useRef<HTMLButtonElement>(null);
 const menuButton=useRef<HTMLButtonElement>(null);
 const closeDrawer=()=>{setDrawerOpen(false);setNavSearch('')};
 useEffect(()=>{setDrawerOpen(false);setNavSearch('')},[path]);
 useEffect(()=>{
  if(!drawerOpen)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  closeButton.current?.focus();
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();closeDrawer();menuButton.current?.focus()}};
  document.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKey)};
 },[drawerOpen]);
 const active=allItems.find(item=>selected(path,item.href));
 const pageTitle=active?.label||'Business workspace';
 const role=businessRole==='owner'?'Business owner':businessRole?businessRole.charAt(0).toUpperCase()+businessRole.slice(1):'Team member';
 const brandName=brand?.name||'BusinessOS';
 return <div className="app-shell business-workspace">
  <header className="topbar work-topbar">
   <div className="work-topbar-left">
    <button ref={menuButton} type="button" className="work-menu-toggle" onClick={()=>setDrawerOpen(true)} aria-label="Open all workspace navigation" aria-expanded={drawerOpen} aria-controls="business-workspace-sidebar"><Menu size={21}/></button>
    <Link className="brand work-brand" href="/dashboard"><span className="brand-mark">{brand?.logo_url?<img src={brand.logo_url} alt="" width={30} height={30} style={{width:30,height:30,objectFit:'contain'}}/>:(brand?.short_name||'B').slice(0,1).toUpperCase()}</span><span className="brand-text">{brandName}</span></Link>
    <span className="work-topbar-divider" aria-hidden="true"/>
    <div className="work-current-page"><span className="work-current-context">BUSINESS WORKSPACE</span><strong>{pageTitle}</strong></div>
   </div>
   <div className="work-topbar-actions">
    {isPlatformAdmin&&<Link className="work-owner-shortcut" href="/admin"><ShieldCheck size={17}/>Admin Console</Link>}
    <Link href="/notifications" title="Notifications" className="work-header-icon" aria-label={`Notifications${unreadCount?` (${unreadCount} unread)`:''}`}><Bell size={19}/>{unreadCount>0&&<span className="work-header-dot"/>}</Link>
    <div className="work-identity" title={`${businessName||'My business'} · ${role}`}><span className="work-identity-icon">{(businessName||'B').slice(0,1).toUpperCase()}</span><span><strong>{businessName||'My business'}</strong><small>{role}</small></span></div>
    <Link className="work-header-icon work-logout" title="Sign out" href="/logout" aria-label="Sign out"><LogOut size={18}/></Link>
   </div>
  </header>
  <div className="layout work-layout">
   <aside className={'sidebar work-sidebar'+(drawerOpen?' open':'')} id="business-workspace-sidebar" aria-label="All business workspace pages" role={drawerOpen?'dialog':undefined} aria-modal={drawerOpen?true:undefined}>
    <div className="work-sidebar-mobile-head"><strong>All business tools</strong><button type="button" ref={closeButton} className="work-sidebar-close" onClick={closeDrawer} aria-label="Close workspace navigation">Close <span aria-hidden="true">×</span></button></div>
    <div className="work-sidebar-intro"><span className="work-sidebar-eyebrow">ACTIVE BUSINESS</span><strong>{businessName||'My business'}</strong><span>{role}</span>{isPlatformAdmin&&<Link href="/admin/my-business" onClick={closeDrawer}>Switch business <ChevronRight size={14}/></Link>}</div>
    <label className="work-nav-search"><Search size={17} aria-hidden="true"/><span className="work-nav-search-label">Find a page</span><input type="search" value={navSearch} onChange={e=>setNavSearch(e.target.value)} placeholder="Search all modules" autoComplete="off"/></label>
    <nav aria-label="Business workspace modules"><NavigationItems path={path} unreadCount={unreadCount} isPlatformAdmin={isPlatformAdmin} onNavigate={closeDrawer} filter={navSearch}/></nav>
    <div className="work-sidebar-end"><Link href="/logout" onClick={closeDrawer} className="work-nav-link"><LogOut size={18}/>Sign out</Link></div>
   </aside>
   {drawerOpen&&<button type="button" className="work-drawer-backdrop" onClick={closeDrawer} aria-label="Close workspace navigation"/>}
   <main className="main work-main" id="business-main"><div className="work-main-inner">{children}</div></main>
  </div>
  <nav className="mobile-nav work-mobile-nav" aria-label="Quick workspace navigation">
   <Link href="/dashboard" aria-current={selected(path,'/dashboard')?'page':undefined}><LayoutDashboard size={20}/>Home</Link>
   <Link href="/orders" aria-current={selected(path,'/orders')?'page':undefined}><ClipboardList size={20}/>Orders</Link>
   <Link href="/customers" aria-current={selected(path,'/customers')?'page':undefined}><Users size={20}/>Customers</Link>
   {isPlatformAdmin?<Link href="/admin" aria-label="System Owner dashboard"><ShieldCheck size={20}/>Admin</Link>:<Link href="/payments" aria-current={selected(path,'/payments')?'page':undefined}><CreditCard size={20}/>Payments</Link>}
   <button type="button" onClick={()=>setDrawerOpen(true)} aria-label="More: show every business module" aria-expanded={drawerOpen} aria-controls="business-workspace-sidebar"><Menu size={20}/>All tools</button>
  </nav>
 </div>;
}
