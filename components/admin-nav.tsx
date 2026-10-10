import Link from 'next/link';
import {signOut} from '@/app/(auth)/login/actions';
export function AdminNav({active}:{active?:'home'|'website'|'businesses'|'personal'}){
 return <nav className="admin-primary-nav" aria-label="System Owner navigation">
  <Link className={active==='home'?'admin-nav-current':''} href="/admin">Overview</Link>
  <Link className={active==='website'?'admin-nav-current':''} href="/admin/website">Website Management</Link>
  <Link href="/admin/plans">Pricing & Plans</Link>
  <Link className={active==='businesses'?'admin-nav-current':''} href="/admin/businesses">Business Management</Link>
  <Link className={active==='personal'?'admin-nav-current':''} href="/admin/my-business">My Business</Link>
  <Link href="/">View Public Website</Link>
  <form action={signOut}><button type="submit" className="btn" aria-label="Sign out of BusinessOS">Sign out</button></form>
 </nav>;
}
