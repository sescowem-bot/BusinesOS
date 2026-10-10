import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
export default function PublicFooter({name,tagline,email}:{name:string;tagline:string;email:string}){
 return <footer className="marketing-footer"><div className="marketing-container"><div className="marketing-footer-top">
  <div className="public-footer-brand"><Link href="/" className="public-footer-logo"><span aria-hidden="true">{name.slice(0,1).toUpperCase()}</span>{name}</Link><p>{tagline||'The simpler way to keep your business moving.'}</p><p className="public-footer-small">Clarity for the work behind every business.</p></div>
  <div><strong>Explore</strong><Link href="/features">Features</Link><Link href="/solutions">Solutions</Link><Link href="/how-it-works">How it works</Link><Link href="/pricing">Plans & pricing</Link></div>
  <div><strong>Company</strong><Link href="/about">About</Link><Link href="/resources">Resources</Link><Link href="/contact">Contact</Link>{email&&<a href={`mailto:${email}`}>Email support <ArrowUpRight size={13}/></a>}</div>
  <div><strong>Account & legal</strong><Link href="/login">Sign in</Link><Link href="/signup">Create workspace</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms of service</Link><Link href="/cookies">Cookies</Link></div>
 </div><div className="marketing-footer-bottom"><span>© {new Date().getFullYear()} {name}. All rights reserved.</span><span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link></span></div></div></footer>
}
