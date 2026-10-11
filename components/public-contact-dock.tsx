import {MessageCircle,Mail} from 'lucide-react';
import {whatsappUrl} from '@/lib/public-contact';
/** Visible help entry point. No client JavaScript or third-party chat SDK. */
export function PublicContactDock({phone,email,brandName}:{phone:string;email:string;brandName:string}){
 const url=whatsappUrl(phone,`Hello ${brandName}, I would like to learn more about your business management platform.`);
 if(!url && !email)return null;
 return <aside className="site-contact-dock" aria-label="Contact platform support">
  {email&&<a href={`mailto:${email}`} className="site-contact-dock-email" aria-label="Email the support team"><Mail size={19}/><span>Email us</span></a>}
  {url&&<a href={url} target="_blank" rel="noopener noreferrer" className="site-contact-dock-whatsapp" aria-label="Chat with our team on WhatsApp"><MessageCircle size={21}/><span>WhatsApp us</span></a>}
 </aside>;
}
