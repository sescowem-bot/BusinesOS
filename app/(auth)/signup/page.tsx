import Link from 'next/link';
import SignupForm from './signup-form';
import {getActiveTerms} from '@/lib/server/legal-documents';
import {getPlatformBrand} from '@/lib/server/branding';
export const dynamic='force-dynamic';
export default async function Signup(){const [b,terms]=await Promise.all([getPlatformBrand(),getActiveTerms()]);return <main className="auth"><div className="auth-card auth-card-accessible"><Link className="brand" href="/"><span className="brand-mark">{b.logo_url?<img src={b.logo_url} alt="" width={35} height={35} style={{objectFit:'contain'}}/>:b.short_name.slice(0,1).toUpperCase()}</span><span>{b.name}</span></Link><h1>Let's get started</h1><p className="muted">Keep your customers, sales and payments together in one workspace.</p>{!terms.available&&<p role="alert">Sign-up is temporarily unavailable. Please try again shortly.</p>}<SignupForm terms={terms.document} available={terms.available}/><p className="small" style={{marginTop:18}}>Already have an account? <Link href="/login">Sign in</Link></p></div></main>}
