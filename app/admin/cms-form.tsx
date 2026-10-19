'use client';
import {useActionState,useState} from 'react';
import {saveCmsPage,saveCmsPlan,type CmsState} from './cms-actions';
import type {PublicPage,PublicPlan} from '@/lib/server/public-cms';
import {editableMarketingCards,editorialOnly,type MarketingCard} from '@/lib/marketing-content';
const initial:CmsState={ok:false,message:''};
type Section={heading:string;body:string;key?:string};
export function PageEditor({page}:{page:PublicPage}){
 const [state,action,pending]=useActionState(saveCmsPage,initial);
 const [sections,setSections]=useState<Section[]>(()=>editorialOnly(Array.isArray(page.sections)?page.sections:[]));
 const [cards,setCards]=useState<MarketingCard[]>(()=>editableMarketingCards(page.slug).map(card=>{const saved=page.sections.find(s=>s.key===card.key);return saved?{...card,title:saved.heading,body:saved.body}:card}));
 const [heading,setHeading]=useState(page.title);
 const [eyebrow,setEyebrow]=useState(page.eyebrow);
 const [intro,setIntro]=useState(page.description);
 function editCard(index:number,field:'title'|'body',value:string){setCards(current=>current.map((c,i)=>i===index?{...c,[field]:value}:c))}
 function editSection(index:number,field:keyof Section,value:string){setSections(old=>old.map((s,i)=>i===index?{...s,[field]:value}:s))}
 return <form action={action} className="cms-form"><h3>Page content</h3><p className="small muted">You are editing {page.slug==='home'?'the homepage':`/${page.slug}`}.</p>{['privacy','terms','cookies'].includes(page.slug)&&<p className="muted small" role="note">Legal document: have the content reviewed and approved before switching on publication. Saving a draft does not publish it unless the checkbox is selected.</p>}<input type="hidden" name="slug" value={page.slug}/>
  <label>Page heading<input name="title" value={heading} onChange={e=>setHeading(e.target.value)} maxLength={160} required/></label>
  <label>Short label above heading<input name="eyebrow" value={eyebrow} onChange={e=>setEyebrow(e.target.value)} maxLength={2000}/></label>
  <label>Introduction<textarea name="description" rows={3} maxLength={2000} value={intro} onChange={e=>setIntro(e.target.value)}/></label>
  {cards.length>0&&<section className="owner-cms-structured"><h3>Edit the sections visitors actually see</h3><p className="muted small">Edit the titles and explanations on the live page. The layout and icons remain consistent. Nothing requires coding.</p>
    {cards.map((card,index)=><details key={card.key} className="owner-card-editor" open={index===0}><summary><strong>{card.label}</strong><span className="small muted">{card.title}</span></summary><label>Visible card title<input value={card.title} maxLength={180} required onChange={e=>editCard(index,'title',e.target.value)}/></label><label>Visible description<textarea value={card.body} maxLength={2000} rows={3} required onChange={e=>editCard(index,'body',e.target.value)}/></label></details>)}
  </section>}
  <h4>Additional content sections</h4><p className="muted small">Edit your headings and paragraphs below. No JSON or coding is needed.</p>
  {sections.map((section,index)=><section className="tax-panel" key={index} style={{marginBottom:12}}>
   <strong>Section {index+1}</strong>
   <label>Section heading<input aria-label={`Section ${index+1} heading`} required maxLength={180} value={section.heading} onChange={e=>editSection(index,'heading',e.target.value)}/></label>
   <label>Section text<textarea aria-label={`Section ${index+1} text`} rows={3} required maxLength={2000} value={section.body} onChange={e=>editSection(index,'body',e.target.value)}/></label>
   <button className="btn" type="button" onClick={()=>setSections(old=>old.filter((_,i)=>i!==index))}>Remove section</button>
  </section>)}
  <button className="btn" type="button" disabled={sections.length>=25} onClick={()=>setSections(old=>[...old,{heading:'',body:''}])}>+ Add section</button>
  <input type="hidden" name="sections" value={JSON.stringify([...sections,...cards.map(card=>({key:card.key,heading:card.title,body:card.body}))])}/>
  <section className="owner-cms-preview" aria-label="Preview of page text"><span className="small muted">Preview · before publishing</span><strong>{heading||'Page heading'}</strong><p>{intro||'Page introduction'}</p>{cards.length>0&&<div><span className="small muted">Featured cards</span><ul>{cards.slice(0,4).map(c=><li key={c.key}>{c.title}</li>)}</ul></div>}</section>
  <label className="cms-check"><input type="checkbox" name="published" defaultChecked={page.published}/> Published on public website</label>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Save page'}</button>
  {state.message&&<span role="status" className={state.ok?'positive':'negative'}>{state.message}</span>}
 </form>;
}
export function PlanEditor({plan}:{plan:PublicPlan}){
 const [state,action,pending]=useActionState(saveCmsPlan,initial);
 const isNew=plan.id==='new-plan';
 return <form action={action} className="cms-form"><h3>{isNew?'Create a plan':plan.name}</h3>
  <label>Plan identifier<input name="id" defaultValue={isNew?'':plan.id} placeholder="e.g. professional" readOnly={!isNew} required/><span className="muted small">Existing identifiers cannot be renamed here because assigned business plans reference them.</span></label>
  <label>Plan name<input name="name" defaultValue={plan.name} maxLength={80} required/></label>
  <label>Price message when no monthly/annual amount is set<input name="price_label" defaultValue={plan.price_label} maxLength={70}/></label>
  <div className="grid grid-2"><label>Monthly price (₦)<input name="price_monthly_ngn" type="number" min="0" step="0.01" defaultValue={plan.id==='free'?'0':String((plan as PublicPlan & {price_monthly_ngn?:number|null}).price_monthly_ngn??'')} readOnly={plan.id==='free'} placeholder="Leave empty for a custom quote"/></label><label>Annual price (₦)<input name="price_yearly_ngn" type="number" min="0" step="0.01" defaultValue={plan.id==='free'?'0':String((plan as PublicPlan & {price_yearly_ngn?:number|null}).price_yearly_ngn??'')} readOnly={plan.id==='free'} placeholder="Leave empty for a custom quote"/></label></div>
  <p className="small muted">Prices saved here are used on the website and during checkout. Leave an amount empty for a custom quote. Changing a displayed price does not charge an existing customer.</p>
  <label>Billing note<input name="billing_label" defaultValue={plan.billing_label} maxLength={2000}/></label>
  <label>Description<textarea name="description" defaultValue={plan.description} maxLength={2000}/></label>
  <label>Additional marketing notes (one per line)<textarea name="features" rows={6} maxLength={5000} defaultValue={Array.isArray(plan.features)?plan.features.join('\n'):''}/></label>
  <p className="small muted">Real module access and role permissions are managed separately under <a href="/admin/plan-access">Plan Access & Roles</a>. These notes never grant a feature automatically.</p>
  <label>CTA label<input name="cta_label" maxLength={90} defaultValue={plan.cta_label}/></label>
  <label>CTA path<input name="cta_url" defaultValue={plan.cta_url} pattern="/[a-z0-9/-]*"/></label>
  <label>Display order<input type="number" name="sort_order" min={0} max={1000} defaultValue={plan.sort_order}/></label>
  <label className="cms-check"><input name="published" type="checkbox" defaultChecked={plan.published}/> Show this plan on the pricing page</label>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Save plan'}</button>
  {state.message&&<span role="status" className={state.ok?'positive':'negative'}>{state.message}</span>}
 </form>;
}
