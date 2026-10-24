'use client';
import {useState} from 'react';
import {ArrowRight,CheckCircle2,ClipboardList,ReceiptText,Users,Wallet} from 'lucide-react';
type Stage={id:string;step:string;title:string;short:string;eyebrow:string;main:string;description:string;notes:string[];icon:typeof Users};
const stages:Stage[]=[
 {id:'customer',step:'01',title:'Know the customer',short:'Customer',eyebrow:'CUSTOMER PROFILE',main:'The right details, ready when you need them.',description:'Keep contacts and order history together instead of searching through separate messages.',notes:['One customer record','A clear starting point','Ready for the next order'],icon:Users},
 {id:'order',step:'02',title:'Record the order',short:'Order',eyebrow:'SALES RECORD',main:'Capture the sale. Keep the details.',description:'Record products, services, amounts and status, with the customer attached.',notes:['Products or services','Agreed amount','Order progress'],icon:ClipboardList},
 {id:'payment',step:'03',title:'Track what is paid',short:'Payment',eyebrow:'PAYMENT ACTIVITY',main:'Part-paid should never mean forgotten.',description:'Record complete or partial payments and keep the remaining balance visible.',notes:['Payment recorded','Outstanding balance','Clearer follow-up'],icon:Wallet},
 {id:'review',step:'04',title:'Stay ready to follow up',short:'Review',eyebrow:'DOCUMENTS & REVIEW',main:'Turn everyday activity into useful records.',description:'Prepare available invoices, review activity and see what needs attention next.',notes:['Available documents','Connected records','Next steps'],icon:ReceiptText}
];
export function PublicBusinessJourney(){
 const [selected,setSelected]=useState(0);
 const current=stages[selected];
 return <section className="mp-journey-feature mp-section" aria-label="Explore the BusinessOS workflow">
  <div className="marketing-container mp-journey-feature__layout">
   <div className="mp-journey-feature__intro">
    <span className="marketing-kicker">YOUR BUSINESS, CONNECTED</span>
    <h2>From the first customer to the final balance.</h2>
    <p>Discover how BusinessOS brings the daily pieces of your business together. Select a step to explore what happens next.</p>
    <div className="mp-journey-feature__choices" aria-label="Business workflow stages">
     {stages.map((stage,i)=><button type="button" key={stage.id} aria-pressed={selected===i} onClick={()=>setSelected(i)} className={'mp-journey-feature__choice'+(selected===i?' is-selected':'')}>
      <span className="mp-journey-feature__number">{stage.step}</span><span><strong>{stage.title}</strong><small>{stage.short} workflow</small></span><ArrowRight size={17} aria-hidden="true"/>
     </button>)}
    </div>
   </div>
   <div className="mp-journey-feature__visual" aria-live="polite" aria-atomic="true">
    <div className="mp-journey-feature__canvas">
     <div className="mp-journey-feature__top"><span><i aria-hidden="true"/> WORKFLOW PREVIEW</span><span>{current.step} / 04</span></div>
     <div className="mp-journey-feature__panel" key={current.id}>
      <div className="mp-journey-feature__glyph"><current.icon size={27} aria-hidden="true"/></div>
      <span className="mp-journey-feature__eyebrow">{current.eyebrow}</span>
      <h3>{current.main}</h3>
      <p>{current.description}</p>
      <div className="mp-journey-feature__notes">{current.notes.map(note=><span key={note}><CheckCircle2 size={16} aria-hidden="true"/>{note}</span>)}</div>
     </div>
     <div className="mp-journey-feature__footer"><span>ILLUSTRATIVE PRODUCT WORKFLOW</span><div className="mp-journey-feature__progress" aria-hidden="true">{stages.map((st,i)=><i key={st.id} className={selected===i?'is-active':''}/>)}</div></div>
    </div>
    <span className="mp-journey-feature__side-note">A connected way to work, not a fictitious live dashboard.</span>
   </div>
  </div>
 </section>;
}
