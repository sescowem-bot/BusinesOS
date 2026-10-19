import Link from 'next/link';
import {ArrowUpRight, MessageCircle, Phone} from 'lucide-react';
import {whatsappUrl,phoneUrl} from '@/lib/public-contact';
import {PublicContactDock} from './public-contact-dock';
import {CookieSettingsButton} from './cookie-preferences';
export default function PublicFooter({name,tagline,email,phone='',logo=''}:{name:string;tagline:string;email:string;phone?:string;logo?:string}){
 const whatsApp=whatsappUrl(phone,`Hello ${name}, I would like to know more about your services.`);
 const call=phoneUrl(phone);
 return <><footer className="marketing-footer"><div className="marketing-container"><div className="marketing-footer-top">
  <div className="public-footer-brand"><Link prefetch={false} href="/" className="public-footer-logo">{logo&&/^https:\/\//.test(logo)?<img src={logo} width={37} height={37} alt="" className="site-footer-logo-img"/>:<span aria-hidden="true">{name.slice(0,1).toUpperCase()}</span>}{name}</Link><p>{tagline||'The simpler way to keep your business moving.'}</p><p className="public-footer-small">Customers. Sales. Stock. Payments. Clearer everyday operations.</p></div>
  <div><strong>Product</strong><Link prefetch={false} href="/features">What you can do</Link><Link prefetch={false} href="/solutions">Who it is for</Link><Link prefetch={false} href="/how-it-works">How it works</Link><Link prefetch={false} href="/pricing">Plans & pricing</Link></div>
  <div><strong>Contact & company</strong><Link prefetch={false} href="/about">About the platform</Link><Link prefetch={false} href="/contact">Talk to our team</Link>{whatsApp&&<a href={whatsApp} target="_blank" rel="noopener noreferrer"><MessageCircle size={14}/> WhatsApp support <ArrowUpRight size={13}/></a>}{call&&<a href={call}><Phone size={13}/> Call us</a>}{email&&<a href={`mailto:${email}`}>Email us <ArrowUpRight size={13}/></a>}</div>
  <div><strong>Your account</strong><Link prefetch={false} href="/login">Sign in</Link><Link prefetch={false} href="/signup">Start free</Link><Link prefetch={false} href="/install">Install {name}</Link><Link prefetch={false} href="/resources">Guides</Link><Link prefetch={false} href="/privacy">Privacy</Link><Link prefetch={false} href="/terms">Terms</Link></div>
 </div><div className="marketing-footer-bottom"><span>© {new Date().getFullYear()} {name}. All rights reserved.</span><span><Link prefetch={false} href="/privacy">Privacy</Link><Link prefetch={false} href="/terms">Terms</Link><Link prefetch={false} href="/cookies">Cookies</Link><CookieSettingsButton className="bo-cookie-footer-trigger"/></span></div></div></footer><PublicContactDock phone={phone} email={email} brandName={name}/></>;
}
