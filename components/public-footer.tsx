import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
export default function PublicFooter({name,tagline,email}:{name:string;tagline:string;email:string}){
 return <footer className="marketing-footer"><div className="marketing-container"><div className="marketing-footer-top">
  <div className="public-footer-brand"><Link prefetch={false} href="/" className="public-footer-logo"><span aria-hidden="true">{name.slice(0,1).toUpperCase()}</span>{name}</Link><p>{tagline||'The simpler way to keep your business moving.'}</p><p className="public-footer-small">Clarity for the work behind every business.</p></div>
  <div><strong>Explore</strong><Link prefetch={false} href="/features">Features</Link><Link prefetch={false} href="/solutions">Solutions</Link><Link prefetch={false} href="/how-it-works">How it works</Link><Link prefetch={false} href="/pricing">Plans & pricing</Link></div>
  <div><strong>Company</strong><Link prefetch={false} href="/about">About</Link><Link prefetch={false} href="/resources">Resources</Link><Link prefetch={false} href="/contact">Contact</Link>{email&&<a href={`mailto:${email}`}>Email support <ArrowUpRight size={13}/></a>}</div>
  <div><strong>Account & legal</strong><Link prefetch={false} href="/login">Sign in</Link><Link prefetch={false} href="/signup">Create workspace</Link><Link prefetch={false} href="/install">Install on your phone</Link><Link prefetch={false} href="/privacy">Privacy</Link><Link prefetch={false} href="/terms">Terms of service</Link><Link prefetch={false} href="/cookies">Cookies</Link></div>
 </div><div className="marketing-footer-bottom"><span>© {new Date().getFullYear()} {name}. All rights reserved.</span><span><Link prefetch={false} href="/privacy">Privacy</Link><Link prefetch={false} href="/terms">Terms</Link><Link prefetch={false} href="/cookies">Cookies</Link></span></div></div></footer>
}
