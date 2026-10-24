'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Cookie,ShieldCheck,SlidersHorizontal,X} from 'lucide-react';

// No optional tracking tags are activated by BusinessOS in this release.
// If analytics/marketing technology is introduced, implement prior-consent
// gating AND update the policy, category settings and this cookie version.
const COOKIE_NAME='businessos_cookie_notice_v2';
const COOKIE_VALUE='necessary_only';
const MAX_AGE=60*60*24*180;
export const OPEN_COOKIE_SETTINGS_EVENT='businessos:open-cookie-settings';

export function CookieSettingsButton({className=''}:{className?:string}){
 return <button type="button" className={className} onClick={()=>
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
 }>Cookie settings</button>;
}

export function CookiePreferences(){
 const pathname=usePathname();
 const showPublicBanner=!/^\/(admin|dashboard|settings|upgrade|orders|customers|expenses|inventory|pos|accounting|reports|tax|products|communications)(?:\/|$)/.test(pathname||'');
 const dialogRef=useRef<HTMLDialogElement>(null);
 const [showBanner,setShowBanner]=useState(false);
 const [open,setOpen]=useState(false);

 useEffect(()=>{
  const previouslySaved=document.cookie.split(';').some(part=>
   part.trim()===COOKIE_NAME+'='+COOKIE_VALUE);
  setShowBanner(!previouslySaved);
  const openSettings=()=>setOpen(true);
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT,openSettings);
  return ()=>window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT,openSettings);
 },[]);
 useEffect(()=>{
  const dialog=dialogRef.current;
  if(!dialog)return;
  if(open&&!dialog.open)dialog.showModal();
  if(!open&&dialog.open)dialog.close();
 },[open]);

 function acknowledge(){
  const secure=window.location.protocol==='https:'?'; Secure':'';
  document.cookie=COOKIE_NAME+'='+COOKIE_VALUE+'; Path=/; Max-Age='+MAX_AGE+'; SameSite=Lax'+secure;
  setShowBanner(false);
  setOpen(false);
 }

 return <>
  {showBanner&&showPublicBanner&&<aside className="bo-cookie-banner" aria-label="Cookie information" role="region">
   <div className="bo-cookie-icon" aria-hidden="true"><Cookie size={22}/></div>
   <div className="bo-cookie-banner-copy">
    <strong>We respect your privacy</strong>
    <p>BusinessOS uses necessary cookies for login and security. Optional tracking cookies are not currently used. Read our <Link href="/cookies">Cookie Notice</Link>.</p>
    <div className="bo-cookie-banner-actions">
     <button type="button" className="bo-cookie-primary" onClick={acknowledge}>Got it</button>
     <button type="button" className="bo-cookie-outline" onClick={()=>setOpen(true)}><SlidersHorizontal size={15}/> Cookie details</button>
    </div>
   </div>
  </aside>}
  <dialog ref={dialogRef} className="bo-cookie-dialog" aria-labelledby="bo-cookie-heading" aria-describedby="bo-cookie-description" onClose={()=>setOpen(false)}>
   <div className="bo-cookie-dialog-top">
    <span className="bo-cookie-dialog-icon" aria-hidden="true"><ShieldCheck size={22}/></span>
    <button type="button" className="bo-cookie-close" onClick={()=>setOpen(false)} aria-label="Close cookie settings"><X size={20}/></button>
   </div>
   <h2 id="bo-cookie-heading">Cookie preferences</h2>
   <p id="bo-cookie-description">We use essential cookies for sign-in and security. Optional analytics and advertising cookies are not currently in use.</p>
   <div className="bo-cookie-category">
    <div><strong>Essential cookies</strong><p>Helps you sign in safely and use the site.</p></div>
    <span className="bo-cookie-pill">Always active</span>
   </div>
   <p className="bo-cookie-dialog-note">Optional analytics and advertising cookies are not currently used, so there are no optional tracking switches to enable.</p>
   <p className="bo-cookie-dialog-note">You can reopen these settings from the footer whenever you need them.</p>
   <div className="bo-cookie-dialog-actions">
    <button type="button" className="bo-cookie-primary" onClick={acknowledge}>Close details</button>
    <Link href="/cookies" onClick={()=>setOpen(false)}>Read Cookie Notice</Link>
   </div>
  </dialog>
 </>;
}
