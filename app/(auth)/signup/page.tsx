import Link from 'next/link';
import SignupForm from './signup-form';
import {getPlatformBrand} from '@/lib/server/branding';
export default async function Signup(){const b=await getPlatformBrand();return <main className="auth"><div className="auth-card"><Link className="brand" href="/"><span className="brand-mark">{b.logo_url?<img src={b.logo_url} alt="" width={35} height={35} style={{objectFit:'contain'}}/>:b.short_name.slice(0,1).toUpperCase()}</span><span>{b.name}</span></Link><h1>Create your account</h1><p className="muted">Securely create an account, then set up your business workspace.</p><SignupForm/><p className="small" style={{marginTop:18}}>Already have an account? <Link href="/login">Sign in</Link></p></div></main>}
