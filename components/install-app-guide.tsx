'use client';
import {useEffect,useState} from 'react';
type BeforeInstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
export function InstallAppGuide(){
 const [pending,setPending]=useState<BeforeInstallEvent|null>(null);
 const [installed,setInstalled]=useState(false);
 const [ios,setIos]=useState(false);
 const [installing,setInstalling]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  const standalone=window.matchMedia('(display-mode: standalone)').matches||
   ('standalone' in navigator && Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
  setInstalled(standalone);
  setIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
  const onPrompt=(event:Event)=>{event.preventDefault();setPending(event as BeforeInstallEvent)};
  const onInstalled=()=>{setInstalled(true);setPending(null);setMessage('BusinessOS has been added to your device.')};
  window.addEventListener('beforeinstallprompt',onPrompt);
  window.addEventListener('appinstalled',onInstalled);
  return ()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)};
 },[]);
 const install=async()=>{
  if(!pending)return;
  setInstalling(true);
  try{await pending.prompt();const choice=await pending.userChoice;
   if(choice.outcome==='accepted')setMessage('Installation requested. Check your device home screen.');
   else setMessage('No problem. You can install BusinessOS later from your browser menu.');
  }catch{setMessage('Automatic installation is unavailable. Use your browser menu below.')}
  finally{setPending(null);setInstalling(false)};
 };
 return <section className="install-guide" aria-label="Install BusinessOS app">
  {installed?<div className="install-success" role="status">BusinessOS is already running as a home-screen app on this device.</div>:<>
   {pending&&<button type="button" className="btn btn-primary install-app-button" onClick={install} disabled={installing}>{installing?'Opening installation…':'Install BusinessOS on this device'}</button>}
   {message&&<p role="status" className="small muted">{message}</p>}
   {ios?<div className="install-steps"><h2>iPhone or iPad</h2><ol><li>Open BusinessOS in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong> (square with upward arrow).</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>. Open BusinessOS from your home screen.</li></ol><p className="small muted">If you're inside WhatsApp or another in-app browser, open the website in Safari first.</p></div>:<div className="install-steps"><h2>Android or desktop</h2><ol><li>Open BusinessOS in <strong>Chrome</strong> or another supported browser.</li><li>Open the browser menu (usually <strong>⋮</strong>).</li><li>Choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li><li>Confirm and open the new icon.</li></ol></div>}
  </>}
  <p className="small muted">BusinessOS is still a web app. It uses your internet connection; installing a shortcut does not enable offline financial transactions or put it in the App Store or Play Store.</p>
 </section>;
}
