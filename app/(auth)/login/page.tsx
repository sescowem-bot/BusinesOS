import Link from 'next/link';
import LoginForm from './login-form';
import {getPlatformBrand} from '@/lib/server/branding';
export default async function Login(){const brand=await getPlatformBrand();return <main className="auth"><div className="auth-card"><div className="brand"><span className="brand-mark">{brand.short_name[0]?.toUpperCase()}</span><span>{brand.name}</span></div><h1>Welcome back</h1><p className="muted">Sign in to your account.</p><LoginForm/><p className="small muted" style={{marginTop:18}}>Business accounts use a secure login. Platform administrator access is granted separately.</p><Link className="small" href="/">Return to website</Link></div></main>}
