'use client';
import {useRef,useState} from 'react';
import type {PointerEvent,ReactNode} from 'react';
import {ArrowUpRight,CheckCircle2,FileText,Layers3,UsersRound,Wallet} from 'lucide-react';

const views=[
 {key:'customers',label:'Customers',title:'Keep every customer in context',copy:'Profiles, orders and follow-ups belong together.',icon:UsersRound},
 {key:'payments',label:'Payments',title:'Know what has been paid',copy:'Record collections and see the balance still outstanding.',icon:Wallet},
 {key:'records',label:'Records',title:'Make every transaction count',copy:'Bring invoices, expenses and daily activity into view.',icon:FileText},
] as const;

/** A responsive product-led hero. Deliberately GPU-light: no canvas, WebGL or JS animation loop. */
export function PublicHeroExperience({children}:{children:ReactNode}){
 const [active,setActive]=useState(0);
 const root=useRef<HTMLDivElement>(null);
 const current=views[active];
 const Icon=current.icon;
 function move(event:PointerEvent<HTMLDivElement>){
  if(event.pointerType!=='mouse'||typeof window==='undefined')return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.boMotion==='reduce')return;
  const rect=event.currentTarget.getBoundingClientRect();
  const px=(event.clientX-rect.left)/rect.width-.5,py=(event.clientY-rect.top)/rect.height-.5;
  const node=root.current;
  if(!node)return;
  node.style.setProperty('--hero-tilt-y',(px*4).toFixed(2)+'deg');
  node.style.setProperty('--hero-tilt-x',(-py*3).toFixed(2)+'deg');
 }
 function reset(){
  root.current?.style.setProperty('--hero-tilt-y','0deg');
  root.current?.style.setProperty('--hero-tilt-x','0deg');
 }
 return <div className="bo-showcase" ref={root} onPointerMove={move} onPointerLeave={reset} aria-label="BusinessOS workspace preview">
  <div className="bo-showcase-atmosphere" aria-hidden="true">
   <span className="bo-showcase-light bo-showcase-light-one"/>
   <span className="bo-showcase-light bo-showcase-light-two"/>
   <span className="bo-showcase-orbit bo-showcase-orbit-one"/>
   <span className="bo-showcase-orbit bo-showcase-orbit-two"/>
  </div>
  <div className="bo-showcase-stage">{children}</div>
  <div className="bo-showcase-insight" aria-live="polite">
   <span className="bo-showcase-insight-icon"><Icon size={17} aria-hidden="true"/></span>
   <span><strong>{current.title}</strong><small>{current.copy}</small></span>
   <CheckCircle2 size={18} className="bo-showcase-insight-check" aria-hidden="true"/>
  </div>
  <div className="bo-showcase-choices" aria-label="Preview product capabilities">
   <span className="bo-showcase-choices-label"><Layers3 size={14} aria-hidden="true"/> EXPLORE</span>
   {views.map((view,index)=><button type="button" key={view.key} aria-pressed={active===index} className={active===index?'is-active':''} onClick={()=>setActive(index)}>{view.label}{active===index&&<ArrowUpRight size={12} aria-hidden="true"/>}</button>)}
  </div>
  <p className="bo-showcase-disclaimer">Illustrative product view · No customer information shown</p>
 </div>;
}
