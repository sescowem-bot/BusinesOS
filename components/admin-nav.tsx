import Link from 'next/link';
export function AdminNav({active}:{active?:'home'|'website'|'businesses'}){
 return <nav className="admin-primary-nav" aria-label="System Owner navigation">
  <Link className={active==='home'?'admin-nav-current':''} href="/admin">Overview</Link>
  <Link className={active==='website'?'admin-nav-current':''} href="/admin/website">Website Management</Link>
  <Link className={active==='businesses'?'admin-nav-current':''} href="/admin/businesses">Business Management</Link>
  <Link href="/">View Public Website</Link>
 </nav>;
}
