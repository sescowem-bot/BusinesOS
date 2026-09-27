'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';
import {Activity,BarChart3,Boxes,BriefcaseBusiness,Building2,Calculator,ClipboardList,CreditCard,FileText,Home,LayoutDashboard,LogOut,Package,Receipt,Settings,ShoppingBag,Store,Users,Wallet,Warehouse,Handshake,Target} from './icons';
const items=[['Dashboard','/dashboard',LayoutDashboard],['Customers','/customers',Users],['Products','/products',Package],['Orders','/orders',ClipboardList],['Payments','/payments',CreditCard],['Expenses','/expenses',Wallet],['Inventory','/inventory',Warehouse],['Quotes','/quotes',FileText],['Invoices','/invoices',Receipt],['Reports','/reports',BarChart3],['Insights','/insights',Activity],['Tasks','/tasks',Target],['Marketplace','/marketplace',Store],['Partners','/partners',Handshake],['Settings','/settings',Settings]] as const;

export function Shell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const router=useRouter();
  const{business,loading}=useBusiness();

  async function signOut(){
    const supabase=getSupabaseBrowser();
    if(supabase)await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return <div className="app-shell"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">B</span><span className="brand-text">BusinessOS</span></Link><div className="kpi-row"><span className="badge badge-brand">{loading?'Loading...':(business?.name||'No workspace')}</span><button onClick={signOut} className="btn" style={{padding:'6px 10px'}}><LogOut size={14}/> Sign out</button></div></header><div className="layout"><aside className="sidebar"><div className="nav-section">Workspace</div>{items.map(([label,href,Icon])=><Link key={href} href={href} className={`nav-item ${path===href||path.startsWith(href+'/')?'active':''}`}><Icon size={17}/><span>{label}</span></Link>)}<div className="nav-section">Platform</div><Link href="/admin" className="nav-item"><Building2 size={17}/><span>Admin</span></Link></aside><main className="main">{children}</main></div><nav className="mobile-nav">{items.slice(0,4).map(([label,href,Icon])=><Link key={href} href={href} className={path.startsWith(href)?'active':''}><Icon size={18}/>{label}</Link>)}</nav></div>;
}
