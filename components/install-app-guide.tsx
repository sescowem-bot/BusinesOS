'use client';
import {useEffect,useState} from 'react';

type BeforeInstallEvent=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
type Device='ios'|'android'|'desktop';
type IosBrowser='chrome'|'safari';

// iPads with desktop-mode browsing can report themselves as Macs. The selector remains available.
function detectDevice():Device{
 const ua=navigator.userAgent;
 const isTouchMac=navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 if(/iPhone|iPad|iPod/i.test(ua)||isTouchMac)return 'ios';
 if(/Android/i.test(ua))return 'android';
 return 'desktop';
}
function detectIosBrowser():IosBrowser{
 return /CriOS/i.test(navigator.userAgent)?'chrome':'safari';
}

export function InstallAppGuide(){
 const [device,setDevice]=useState<Device>('ios');
 const [iosBrowser,setIosBrowser]=useState<IosBrowser>('safari');
 const [pending,setPending]=useState<BeforeInstallEvent|null>(null);
 const [installed,setInstalled]=useState(false);
 const [installing,setInstalling]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  setDevice(detectDevice());
  setIosBrowser(detectIosBrowser());
  setInstalled(window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
  const onPrompt=(event:Event)=>{event.preventDefault();setPending(event as BeforeInstallEvent)};
  const onInstalled=()=>{setInstalled(true);setPending(null);setMessage('BusinessOS is ready on your device.')};
  window.addEventListener('beforeinstallprompt',onPrompt);
  window.addEventListener('appinstalled',onInstalled);
  return ()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)};
 },[]);
 async function install(){
  if(!pending)return;
  setInstalling(true);
  try{
   await pending.prompt();
   const choice=await pending.userChoice;
   setMessage(choice.outcome==='accepted'?'You can now open BusinessOS from your device.':'You can add BusinessOS from your browser menu whenever you’re ready.');
  }catch{setMessage('Use the steps below to add BusinessOS to your device.');}
  finally{setPending(null);setInstalling(false)}
 }
 return <section className="install-guide" aria-label="Install BusinessOS on your device">
  {installed?<div className="install-success" role="status"><strong>BusinessOS is already installed.</strong> Open your workspace to get started.</div>:<>
   <p className="small muted">Choose your device to see how to add BusinessOS.</p>
   <div className="install-device-picker" role="group" aria-label="Choose your device">
    <button type="button" aria-pressed={device==='ios'} className={'install-device-option'+(device==='ios'?' active':'')} onClick={()=>setDevice('ios')}>iPhone / iPad</button>
    <button type="button" aria-pressed={device==='android'} className={'install-device-option'+(device==='android'?' active':'')} onClick={()=>setDevice('android')}>Android</button>
    <button type="button" aria-pressed={device==='desktop'} className={'install-device-option'+(device==='desktop'?' active':'')} onClick={()=>setDevice('desktop')}>Computer</button>
   </div>
   {pending&&device!=='ios'&&<button type="button" className="btn btn-primary install-app-button" onClick={install} disabled={installing}>{installing?'Opening…':'Install BusinessOS'}</button>}
   {message&&<p role="status" className="small muted">{message}</p>}
   {device==='ios'&&<div className="install-steps" aria-live="polite">
    <h3>Install on iPhone or iPad</h3>
    <p className="small muted">Both Chrome and Safari can add BusinessOS to your Home Screen. Choose the browser you’re using:</p>
    <div className="install-browser-picker" role="group" aria-label="Choose your iPhone browser">
     <button type="button" aria-pressed={iosBrowser==='chrome'} className={'install-browser-option'+(iosBrowser==='chrome'?' active':'')} onClick={()=>setIosBrowser('chrome')}>Chrome</button>
     <button type="button" aria-pressed={iosBrowser==='safari'} className={'install-browser-option'+(iosBrowser==='safari'?' active':'')} onClick={()=>setIosBrowser('safari')}>Safari</button>
    </div>
    {iosBrowser==='chrome'?<ol key="chrome">
     <li>Open <strong>BusinessOS in Chrome</strong> on your iPhone or iPad.</li>
     <li>Tap <strong>Share</strong> <span role="img" aria-label="Share">▢↑</span> beside the address bar.</li>
     <li>Scroll through the options and tap <strong>Add to Home Screen</strong>.</li>
     <li>Confirm the name, then tap <strong>Add</strong>. Open BusinessOS from your Home Screen.</li>
    </ol>:<ol key="safari">
     <li>Open <strong>BusinessOS in Safari</strong> on your iPhone or iPad.</li>
     <li>Tap <strong>Share</strong> <span role="img" aria-label="Share">▢↑</span> (you may need to open the page menu first).</li>
     <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
     <li>Keep <strong>Open as Web App</strong> enabled if your iPhone shows the option, then tap <strong>Add</strong>.</li>
    </ol>}
    <p className="small muted">Can’t see “Add to Home Screen”? Scroll further down the Share menu. In Safari, choose <strong>Edit Actions</strong> if needed. If Chrome doesn’t offer the option on your device, try Safari instead. If you opened the link inside WhatsApp or another in-app browser, use its menu to open BusinessOS in Chrome or Safari first. Your browser must support adding websites to the Home Screen.</p>
   </div>}
   {device==='android'&&<div className="install-steps" aria-live="polite"><h3>Install on Android</h3><ol>
    <li>Open BusinessOS in <strong>Chrome</strong>.</li><li>Tap the browser menu <strong>⋮</strong>.</li>
    <li>Choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li><li>Confirm to add the BusinessOS icon.</li>
   </ol></div>}
   {device==='desktop'&&<div className="install-steps" aria-live="polite"><h3>Install on your computer</h3><ol>
    <li>Open BusinessOS in Chrome or Microsoft Edge.</li><li>Look for the <strong>Install</strong> icon in the address bar, or open the browser menu.</li><li>Select <strong>Install BusinessOS</strong> if available.</li><li>Open BusinessOS from your apps or desktop shortcut.</li>
   </ol></div>}
  </>}
  <p className="small muted">Use your usual BusinessOS sign-in details. An internet connection is needed to view and save business records. You don’t need a separate App Store or Play Store download.</p>
 </section>;
}
