'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {PlatformBrand} from '@/lib/server/branding';
import {WorkspaceLoadingBrandProvider} from './workspace-loading-brand';
import {workspaceNavigationGroups,workspaceRoleCanSeeLink,mobileWorkspacePaths,type WorkspaceNavMode} from '@/lib/workspace-navigation';
import './workspace-navigation.css';
import {Activity,BarChart3,Bell,BriefcaseBusiness,Building2,Calculator,ChevronRight,ClipboardList,CreditCard,FileText,Home,LayoutDashboard,LogOut,Menu,Package,Receipt,Search,Settings,Store,Target,Users,Wallet,Warehouse,Handshake,ShieldCheck} from './icons';

type NavigationItem={label:string;href:string;icon:typeof LayoutDashboard;feature?:string};
type NavigationGroup={title:string;items:NavigationItem[]};
const groups:NavigationGroup[]=[
 {title:'Overview',items:[{label:'Dashboard',href:'/dashboard',icon:LayoutDashboard},{label:'Getting started',href:'/getting-started',icon:ClipboardList},{label:'Notifications',href:'/notifications',icon:Bell}]},
 {title:'Sales & customers',items:[{label:'Customers',href:'/customers',icon:Users},{label:'Orders & sales',href:'/orders',icon:ClipboardList},{label:'Retail POS',href:'/pos',icon:Store},{label:'Wholesale pricing',href:'/wholesale',icon:Package},{label:'Cashier shifts',href:'/pos/shifts',icon:Wallet},{label:'Returns & credit notes',href:'/returns',icon:Receipt},{label:'Products & services',href:'/products',icon:Package},{label:'Invoices',href:'/invoices',icon:Receipt},{label:'Payments',href:'/payments',icon:CreditCard},{label:'Outstanding & instalments',href:'/receivables',icon:Wallet}]},
 {title:'Operations',items:[{label:'Expenses',href:'/expenses',icon:Wallet},{label:'Inventory',href:'/inventory',icon:Warehouse},{label:'Branch stock & transfers',href:'/inventory/locations',icon:Warehouse},{label:'Suppliers & purchasing',href:'/purchasing',icon:Package},{label:'Tasks',href:'/tasks',icon:Target},{label:'My team',href:'/team',icon:Users},{label:'Team updates',href:'/team/updates',icon:Users}]},
 {title:'Finance & compliance',items:[{label:'Accounting',href:'/accounting',icon:Calculator},{label:'Financial reports',href:'/reports',icon:BarChart3},{label:'Retail performance',href:'/retail-reports',icon:BarChart3},{label:'Tax Centre',href:'/tax-centre',icon:Calculator},]},
 {title:'Engagement & growth',items:[{label:'Customer notes',href:'/communications',icon:Users},{label:'Insights',href:'/insights',icon:Activity},{label:'Growth Centre',href:'/growth',icon:BriefcaseBusiness},{label:'Business directory',href:'/directory',icon:Store},]},
 {title:'Workspace',items:[{label:'Plans & billing',href:'/upgrade',icon:CreditCard},{label:'Export records',href:'/exports',icon:FileText},{label:'Install on phone',href:'/install',icon:Home},{label:'Help & support',href:'/support',icon:ShieldCheck},{label:'Settings',href:'/settings',icon:Settings}]}
];
const ownerLinks:NavigationItem[]=[
 {label:'Admin Console',href:'/admin',icon:ShieldCheck},
 {label:'Brand & website',href:'/admin/website',icon:Home},
 {label:'Manage businesses',href:'/admin/businesses',icon:Building2},{label:'Support & roles',href:'/admin/support',icon:ShieldCheck},
 {label:'Manage plans and pricing',href:'/admin/plans',icon:CreditCard},{label:'Automation service requests',href:'/admin/automations',icon:Target},
 {label:'Pilot readiness',href:'/admin/pilot',icon:ShieldCheck},
 {label:'Switch my business',href:'/admin/my-business',icon:BriefcaseBusiness}
];
const restrictedModules:Record<string,string>={
 '/customers':'customers','/orders':'orders','/products':'products',
 '/payments':'payments','/receivables':'payments','/expenses':'expenses',
 '/invoices':'documents','/exports':'documents','/settings':'settings',
 '/tasks':'team','/team/updates':'team',
 '/pos':'pos','/pos/shifts':'pos','/returns':'pos','/wholesale':'pos',
 '/inventory':'inventory','/inventory/locations':'inventory','/purchasing':'purchasing',
 '/accounting':'accounting','/reports':'financial_reports','/retail-reports':'financial_reports',
 '/tax-centre':'tax','/tax-profile':'tax','/tax-compliance':'tax',
 '/communications':'communications','/insights':'insights','/growth':'growth'
};
// Management-only modules must also be hidden when the staff role does not qualify.
const roleRestrictedModules:Record<string,readonly string[]>={
 '/accounting':['owner','manager','finance'],
 '/reports':['owner','manager','finance'],
 '/retail-reports':['owner','manager','finance']
};
const allItems=groups.flatMap(g=>g.items);
const selected=(path:string,href:string)=>path===href||(href!=='/admin'&&href!=='/dashboard'&&path.startsWith(href+'/'));

function NavigationItems({path,isPlatformAdmin,unreadCount,onNavigate,filter,enabledFeatures,businessRole,mode}:{path:string;isPlatformAdmin:boolean;unreadCount:number;onNavigate:()=>void;filter:string;enabledFeatures:string[];businessRole?:string;mode:WorkspaceNavMode}){
 const term=filter.trim().toLocaleLowerCase();
 const accessibleGroups=[...(isPlatformAdmin?[{title:'Platform administration',items:ownerLinks}]:[]),...groups]
  .map(group=>({...group,items:group.items.filter(item=>(!restrictedModules[item.href]||enabledFeatures.includes(restrictedModules[item.href]))&&(!roleRestrictedModules[item.href]||roleRestrictedModules[item.href].includes(businessRole||''))&&(item.href!=='/receivables'||['owner','manager','finance','sales'].includes(businessRole||''))&&workspaceRoleCanSeeLink(businessRole,item.href)&&(!term||`${item.label} ${group.title}`.toLocaleLowerCase().includes(term)))}))
  .filter(group=>group.items.length>0);
 const visibleGroups=workspaceNavigationGroups(accessibleGroups,{mode,search:term,pathname:path,role:businessRole});
 return <>
 {visibleGroups.map(group=><section className="work-nav-group" key={group.title} aria-label={group.title}>
   <div className="work-nav-heading">{group.title}</div>
   {group.items.map(({label,href,icon:Icon})=>{
     const active=selected(path,href);
     return <Link key={href} prefetch={false} onClick={onNavigate} href={href} className={'work-nav-link'+(active?' active':'')} aria-current={active?'page':undefined}>
       <Icon size={18} aria-hidden="true"/><span>{label}</span>
       {href==='/notifications'&&unreadCount>0&&<span className="work-nav-count">{unreadCount>99?'99+':unreadCount}</span>}
     </Link>;
   })}
 </section>)}
 {visibleGroups.length===0&&<p className="work-nav-no-results">No matching page. Try searching for orders, inventory, finance or admin.</p>}
 </>;
}

export function Shell({children,brand,businessRole,businessName,businessLogo,unreadCount=0,isPlatformAdmin=false,enabledFeatures=[]}:{children:React.ReactNode;brand?:Pick<PlatformBrand,'name'|'short_name'|'logo_url'>;businessRole?:string;businessName?:string;businessLogo?:string|null;unreadCount?:number;isPlatformAdmin?:boolean;enabledFeatures?:string[]}){
 const path=usePathname();
 const [drawerOpen,setDrawerOpen]=useState(false);
 const [navSearch,setNavSearch]=useState('');
 const [showAllTools,setShowAllTools]=useState(false);
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
 const mobileLinks=mobileWorkspacePaths(businessRole,isPlatformAdmin).filter(href=>!restrictedModules[href]||enabledFeatures.includes(restrictedModules[href]));
 const brandName=brand?.name||'BusinessOS';
 return <div className="app-shell business-workspace"><a className="work-skip-link" href="#business-main">Skip to main content</a>
  <header className="topbar work-topbar">
   <div className="work-topbar-left">
    <button ref={menuButton} type="button" className="work-menu-toggle" onClick={()=>setDrawerOpen(true)} aria-label="Open all workspace navigation" aria-expanded={drawerOpen} aria-controls="business-workspace-sidebar"><Menu size={21}/></button>
    <Link className="brand work-brand" href="/dashboard"><span className="brand-mark">{brand?.logo_url?<img src={brand.logo_url} alt="" width={30} height={30} style={{width:30,height:30,objectFit:'contain'}}/>:(brand?.short_name||'B').slice(0,1).toUpperCase()}</span><span className="brand-text">{brandName}</span></Link>
    <span className="work-topbar-divider" aria-hidden="true"/>
    <div className="work-current-page"><span className="work-current-context">BUSINESS WORKSPACE</span><strong>{pageTitle}</strong></div>
   </div>
   <div className="work-topbar-actions">
    {isPlatformAdmin&&<Link className="work-owner-shortcut" href="/admin" prefetch={false}><ShieldCheck size={17}/>Admin Console</Link>}
    <Link href="/notifications" prefetch={false} title="Notifications" className="work-header-icon" aria-label={`Notifications${unreadCount?` (${unreadCount} unread)`:''}`}><Bell size={19}/>{unreadCount>0&&<span className="work-header-dot"/>}</Link>
    <div className="work-identity" title={`${businessName||'My business'} · ${role}`}><span className="work-identity-icon">{businessLogo&&businessLogo.startsWith('https://')?<img src={businessLogo} alt="" width={38} height={38} style={{width:38,height:38,objectFit:"cover",borderRadius:10}}/>:(businessName||'B').slice(0,1).toUpperCase()}</span><span><strong>{businessName||'My business'}</strong><small>{role}</small></span></div>
    <Link prefetch={false} className="work-header-icon work-logout" title="Sign out" href="/logout" aria-label="Sign out"><LogOut size={18}/></Link>
   </div>
  </header>
  <div className="layout work-layout">
   <aside className={'sidebar work-sidebar'+(drawerOpen?' open':'')} id="business-workspace-sidebar" aria-label="All business workspace pages" role={drawerOpen?'dialog':undefined} aria-modal={drawerOpen?true:undefined}>
    <div className="work-sidebar-mobile-head"><strong>All business tools</strong><button type="button" ref={closeButton} className="work-sidebar-close" onClick={closeDrawer} aria-label="Close workspace navigation">Close <span aria-hidden="true">×</span></button></div>
    <div className="work-sidebar-intro"><span className="work-sidebar-eyebrow">ACTIVE BUSINESS</span><strong>{businessName||'My business'}</strong><span>{role}</span>{isPlatformAdmin&&<Link href="/admin/my-business" onClick={closeDrawer}>Switch business <ChevronRight size={14}/></Link>}</div>
    <div className="work-nav-view-toggle" aria-label="Navigation view">
     <span className="work-nav-view-label">Workspace navigation</span>
     <div className="work-nav-view-options" role="group" aria-label="Choose navigation view">
      <button type="button" aria-pressed={!showAllTools} onClick={()=>setShowAllTools(false)}>Simple</button>
      <button type="button" aria-pressed={showAllTools} onClick={()=>setShowAllTools(true)}>All tools</button>
     </div>
     {!showAllTools&&<p className="work-nav-mode-hint">Your everyday pages. Search or choose All tools for more.</p>}
    </div>
    <label className="work-nav-search"><Search size={17} aria-hidden="true"/><span className="work-nav-search-label">Find a page</span><input type="search" value={navSearch} onChange={e=>setNavSearch(e.target.value)} placeholder="Search all modules" autoComplete="off"/></label>
    <nav aria-label="Business workspace modules"><NavigationItems path={path} unreadCount={unreadCount} isPlatformAdmin={isPlatformAdmin} onNavigate={closeDrawer} filter={navSearch} enabledFeatures={enabledFeatures} businessRole={businessRole} mode={showAllTools?'advanced':'simple'}/></nav>
    <div className="work-sidebar-end"><Link href="/logout" prefetch={false} onClick={closeDrawer} className="work-nav-link"><LogOut size={18}/>Sign out</Link></div>
   </aside>
   {drawerOpen&&<button type="button" className="work-drawer-backdrop" onClick={closeDrawer} aria-label="Close workspace navigation"/>}
   <main className="main work-main" id="business-main"><div className="work-main-inner"><WorkspaceLoadingBrandProvider branding={{logoUrl:businessLogo||brand?.logo_url,businessName,platformName:brand?.name}}>{children}</WorkspaceLoadingBrandProvider></div></main>
  </div>
  <nav className="mobile-nav work-mobile-nav" aria-label="Quick workspace navigation">
   <Link href="/dashboard" prefetch={false} aria-current={selected(path,'/dashboard')?'page':undefined}><LayoutDashboard size={20}/>Home</Link>
   {mobileLinks.includes('/orders')&&<Link href="/orders" prefetch={false} aria-current={selected(path,'/orders')?'page':undefined}><ClipboardList size={20}/>Orders</Link>}
   {mobileLinks.includes('/customers')&&<Link href="/customers" prefetch={false} aria-current={selected(path,'/customers')?'page':undefined}><Users size={20}/>Customers</Link>}
   {isPlatformAdmin?<Link href="/admin" prefetch={false} aria-label="System Owner dashboard"><ShieldCheck size={20}/>Admin</Link> :mobileLinks.includes('/payments')?<Link href="/payments" prefetch={false} aria-current={selected(path,'/payments')?'page':undefined}><CreditCard size={20}/>Payments</Link>:null}
   <button type="button" onClick={()=>{setShowAllTools(true);setDrawerOpen(true)}} aria-label="More: show every business module" aria-expanded={drawerOpen} aria-controls="business-workspace-sidebar"><Menu size={20}/>All tools</button>
  </nav>
 </div>;
}
