'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Cookie,ShieldCheck,SlidersHorizontal,X,Info,Check,MousePointer2,BarChart3,Megaphone} from 'lucide-react';

/** Store only explicit user choices. Security/session cookies are never switched off here.
 * No third-party analytics or marketing tags are currently loaded on BusinessOS.
 * If trackers are installed later, they MUST be blocked until separate fresh consent.
 */
const COOKIE_NAME='businessos_cookie_notice_v3';
const MOTION_COOKIE='businessos_visual_motion_v1';
const MAX_AGE=60*60*24*180;
export const OPEN_COOKIE_SETTINGS_EVENT='businessos:open-cookie-settings';
type Choice='necessary'|'custom';
function getCookie(key:string){
 if(typeof document==='undefined')return null;
 const pair=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(key+'='));
 if(!pair)return null;
 try{return decodeURIComponent(pair.slice(key.length+1));}catch{return null;}
}
function putCookie(key:string,value:string,maxAge=MAX_AGE){
 const secure=window.location.protocol==='https:'?'; Secure':'';
 document.cookie=key+'='+encodeURIComponent(value)+'; Path=/; Max-Age='+maxAge+'; SameSite=Lax'+secure;
}
function applyMotion(reduce:boolean){
 document.documentElement.dataset.boMotion=reduce?'reduce':'normal';
}
export function CookieSettingsButton({className=''}:{className?:string}){
 return <button type="button" className={className} onClick={()=>window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}>Cookie settings</button>;
}
export function CookiePreferences(){
 const pathname=usePathname();
 const publicArea=!/^\/(admin|dashboard|settings|upgrade|orders|customers|expenses|inventory|pos|accounting|reports|tax|products|communications|onboarding|renewals)(?:\/|$)/.test(pathname||'');
 const modal=useRef<HTMLDialogElement>(null);
 const [ready,setReady]=useState(false);
 const [decision,setDecision]=useState<Choice|null>(null);
 const [reduceMotion,setReduceMotion]=useState(false);
 const [open,setOpen]=useState(false);
 const [feedback,setFeedback]=useState('');
 useEffect(()=>{
  const saved=getCookie(COOKIE_NAME);
  setDecision(saved==='necessary'||saved==='custom'?saved:null);
  const reduced=getCookie(MOTION_COOKIE)==='reduce';
  setReduceMotion(reduced);
  applyMotion(reduced);
  setReady(true);
  const openSettings=()=>{
   setReduceMotion(getCookie(MOTION_COOKIE)==='reduce');
   setFeedback('');
   setOpen(true);
  };
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT,openSettings);
  return ()=>window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT,openSettings);
 },[]);
 useEffect(()=>{
  const d=modal.current;
  if(!d)return;
  if(open&&!d.open)d.showModal();
  if(!open&&d.open)d.close();
 },[open]);
 function saveChoice(choice:Choice,reduced:boolean){
  putCookie(COOKIE_NAME,choice);
  if(reduced){putCookie(MOTION_COOKIE,'reduce');}else{
   putCookie(MOTION_COOKIE,'',0);
  }
  applyMotion(reduced);
  setReduceMotion(reduced);
  setDecision(choice);
  setFeedback('Your cookie preferences were saved.');
  setOpen(false);
 }
 if(!ready||!publicArea)return null;
 return <>
  {decision===null&&<aside className="bo-cookie-banner bo-cookie-banner-v3" aria-label="Cookie choices" role="region">
   <div className="bo-cookie-icon" aria-hidden="true"><Cookie size={23}/></div>
   <div className="bo-cookie-banner-copy">
    <span className="bo-cookie-eyebrow">YOUR PRIVACY, YOUR CHOICE</span>
    <strong>We use cookies responsibly.</strong>
    <p>Essential cookies keep BusinessOS secure and signed in. You can also save a visual display preference. We do not use advertising or analytics trackers.</p>
    <div className="bo-cookie-banner-actions">
     <button type="button" className="bo-cookie-primary" onClick={()=>saveChoice('necessary',false)}>Necessary only</button>
     <button type="button" className="bo-cookie-outline" onClick={()=>setOpen(true)}><SlidersHorizontal size={15} aria-hidden="true"/> Customise</button>
    </div>
    <Link href="/cookies" className="bo-cookie-banner-link">Read our Cookie Notice</Link>
   </div>
  </aside>}
  {decision!==null&&<button className="bo-cookie-floating-trigger" type="button" onClick={()=>setOpen(true)} aria-label="Review cookie preferences"><Cookie size={16} aria-hidden="true"/> Privacy choices</button>}
  <dialog ref={modal} className="bo-cookie-dialog bo-cookie-dialog-v3" aria-labelledby="bo-cookie-heading" aria-describedby="bo-cookie-description" onClose={()=>setOpen(false)} onCancel={()=>setOpen(false)}>
   <div className="bo-cookie-dialog-top">
    <span className="bo-cookie-dialog-icon" aria-hidden="true"><ShieldCheck size={23}/></span>
    <button type="button" className="bo-cookie-close" onClick={()=>setOpen(false)} aria-label="Close cookie settings"><X size={20}/></button>
   </div>
   <span className="bo-cookie-eyebrow">BUSINESSOS PRIVACY CENTRE</span>
   <h2 id="bo-cookie-heading">Your cookie preferences</h2>
   <p id="bo-cookie-description">Choose how BusinessOS remembers your experience. Only essential cookies are required. Change your preferences here whenever you like.</p>
   <div className="bo-cookie-status"><Info size={16} aria-hidden="true"/><span>No analytics or advertising cookies are active on this website.</span></div>
   <div className="bo-cookie-category">
    <div><strong><ShieldCheck size={16} aria-hidden="true"/> Essential security</strong><p>Sign-in sessions, account protection and the record of your cookie choice.</p></div>
    <span className="bo-cookie-pill">Always active</span>
   </div>
   <label className="bo-cookie-category bo-cookie-category-switch" htmlFor="bo-motion-preference">
    <span className="bo-cookie-category-text"><strong><MousePointer2 size={16} aria-hidden="true"/> Visual preferences</strong>
     <span className="bo-cookie-descriptor">Optional — remember my choice to reduce decorative motion, including animated hero effects.</span></span>
    <span className="bo-cookie-switch"><input type="checkbox" id="bo-motion-preference" checked={reduceMotion} onChange={event=>setReduceMotion(event.target.checked)} /><span className="bo-cookie-switch-track" aria-hidden="true"/></span>
   </label>
   <div className="bo-cookie-category bo-cookie-inactive"><div><strong><BarChart3 size={16} aria-hidden="true"/> Analytics</strong><p>Not installed. We are not currently setting analytics tracking cookies.</p></div><span className="bo-cookie-pill bo-cookie-off">Not in use</span></div>
   <div className="bo-cookie-category bo-cookie-inactive"><div><strong><Megaphone size={16} aria-hidden="true"/> Advertising</strong><p>Not installed. No advertising or remarketing cookies are enabled.</p></div><span className="bo-cookie-pill bo-cookie-off">Not in use</span></div>
   <div className="bo-cookie-dialog-actions bo-cookie-dialog-actions-v3">
    <button type="button" className="bo-cookie-outline" onClick={()=>saveChoice('necessary',false)}>Necessary only</button>
    <button type="button" className="bo-cookie-primary" onClick={()=>saveChoice(reduceMotion?'custom':'necessary',reduceMotion)}><Check size={16} aria-hidden="true"/> Save preferences</button>
   </div>
   <p className="bo-cookie-dialog-footnote">Preferences remain available from the website footer or the Privacy choices button. See the <Link href="/cookies" onClick={()=>setOpen(false)}>Cookie Notice</Link> for details.</p>
  </dialog>
  <span className="sr-only" role="status" aria-live="polite">{feedback}</span>
 </>;
}
