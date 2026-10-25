'use client';

import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,SlidersHorizontal} from 'lucide-react';

type Plan={id:string;name:string;price_monthly_ngn?:number|null;price_yearly_ngn?:number|null};
type CapabilityMap=Record<string,string[]>;
const needs=[
 {key:'core',label:'Everyday business records',feature:null,detail:'Customer profiles, orders, expenses and payments'},
 {key:'pos',label:'Retail checkout',feature:'pos',detail:'Point of sale for in-store orders'},
 {key:'inventory',label:'Inventory and stock',feature:'inventory',detail:'Track stock and available quantities'},
 {key:'team',label:'Staff and branch operations',feature:'team',detail:'Team and branch controls on eligible plans'},
 {key:'accounting',label:'Accounting workspace',feature:'accounting',detail:'Manual ledgers and journal records'}
] as const;
const money=(value:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(value);

/** A decision aid using only current published plan grants, never an upsell guess. */
export function PublicPlanNavigator({plans,byPlan,available}:{plans:Plan[];byPlan:CapabilityMap;available:boolean}){
 const [purpose,setPurpose]=useState<(typeof needs)[number]['key']>('core');
 const [billing,setBilling]=useState<'monthly'|'annual'>('monthly');
 const selected=needs.find(x=>x.key===purpose)||needs[0];
 const matches=selected.feature===null?plans:available?plans.filter(p=>(byPlan[p.id]||[]).includes(selected.feature!)):[];
 return <section className="bo-plan-navigator" aria-label="Explore plans by business need">
  <div className="bo-plan-navigator-intro"><div><span className="marketing-kicker">EXPLORE YOUR OPTIONS</span><h3>Find the tools your business needs.</h3><p>Choose a workflow and billing period to compare published plans. Actual subscriptions and payment terms are confirmed during checkout.</p></div><SlidersHorizontal size={25} aria-hidden="true"/></div>
  <div className="bo-plan-navigator-controls"><label>My main need<select value={purpose} onChange={e=>setPurpose(e.target.value as typeof purpose)}>{needs.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
   <div className="bo-plan-period" role="group" aria-label="Compare billing periods"><span>View prices</span><div><button type="button" aria-pressed={billing==='monthly'} className={billing==='monthly'?'is-active':''} onClick={()=>setBilling('monthly')}>Monthly</button><button type="button" aria-pressed={billing==='annual'} className={billing==='annual'?'is-active':''} onClick={()=>setBilling('annual')}>Annually</button></div></div>
  </div>
  <p className="bo-plan-navigator-need"><CheckCircle2 size={17}/>{selected.detail}</p>
  {!available&&selected.feature!==null?<p className="bo-plan-empty" role="status">Current module assignments could not be verified. See the full plan table or contact support before choosing a plan.</p>:
   matches.length===0?<p className="bo-plan-empty" role="status">None of the currently published plans list this module. Contact us to discuss availability.</p>:
   <div className="bo-plan-results" aria-live="polite">{matches.map(p=>{
    const amount=p.id==='free'?0:billing==='annual'?p.price_yearly_ngn:p.price_monthly_ngn;
    const shown=amount!=null&&Number(amount)>=0?money(Number(amount)):null;
    return <article key={p.id}><div><strong>{p.name}</strong><span>{p.id==='free'?'Core workspace':selected.feature===null?'Published plan':'Includes selected module'}</span></div><p>{shown||'Price not published'}{shown&&p.id!=='free'&&<small> / {billing==='annual'?'year':'month'}</small>}</p><Link href={'#plan-'+p.id}>View full plan <ArrowRight size={15}/></Link></article>;
   })}</div>}
  <p className="bo-plan-disclaimer">Feature assignments come from the currently published plan catalogue. Annual pricing is displayed only where published. This tool does not reserve a plan or bypass payment verification.</p>
 </section>;
}
export function PublicPlanComparisonControls({children,enabled,differenceCount}:{children:ReactNode;enabled:boolean;differenceCount:number}){
 const [diff,setDiff]=useState(false);
 return <div className={diff&&enabled?'bo-compare-differences':''}>
  <div className="bo-compare-control"><div><strong>Detailed feature comparison</strong><span>{enabled?differenceCount+' additional features vary between published plans':'Plan assignments temporarily unavailable'}</span></div><label><input type="checkbox" checked={diff} disabled={!enabled} onChange={e=>setDiff(e.target.checked)}/> Show differences only</label></div>
  {children}
 </div>;
}
