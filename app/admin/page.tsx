import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {BrandingForm} from './branding-form';
import {signOut} from '../(auth)/login/actions';
export const dynamic='force-dynamic';
export default async function AdminPage(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-access"><div className="card card-pad"><span className="badge badge-warning">Restricted area</span><h1>Platform administration</h1><p>Sign in with an authorised platform administrator account. Business owners do not automatically receive platform-level access.</p><Link href="/login" className="btn btn-primary">Sign in</Link><Link href="/" className="btn">Back to website</Link></div></main>;
 const brand=await getPlatformBrand();
 return <main className="admin-area"><header className="admin-header"><div><span className="badge badge-brand">Super Admin</span><h1>Platform settings</h1><p>Control your software identity from one secure workspace.</p></div><div style={{display:"flex",gap:8}}><Link className="btn btn-primary" href="/admin/content">Content & pricing CMS</Link><Link className="btn" href="/">View website</Link><form action={signOut}><button className="btn" type="submit">Sign out</button></form></div></header><div className="admin-layout"><section className="card card-pad"><BrandingForm brand={brand}/></section><aside className="card card-pad"><h2>Live identity</h2><p className="small muted">Current published platform branding</p><div className="brand-preview"><div className="brand-mark">{brand.short_name.slice(0,1).toUpperCase()}</div><strong>{brand.name}</strong><p>{brand.tagline}</p></div><p className="small muted">Only verified platform administrators can publish changes. All changes are audited by the database.</p></aside></div></main>;
}
