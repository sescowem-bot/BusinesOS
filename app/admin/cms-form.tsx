'use client';
import {useActionState,useState} from 'react';
import {saveCmsPage,saveCmsPlan,type CmsState} from './cms-actions';
import type {PublicPage,PublicPlan} from '@/lib/server/public-cms';
const initial:CmsState={ok:false,message:''};
type Section={heading:string;body:string};
export function PageEditor({page}:{page:PublicPage}){
 const [state,action,pending]=useActionState(saveCmsPage,initial);
 const [sections,setSections]=useState<Section[]>(()=>Array.isArray(page.sections)?page.sections.filter(s=>s&&typeof s.heading==='string'&&typeof s.body==='string'):[]);
 function editSection(index:number,field:keyof Section,value:string){setSections(old=>old.map((s,i)=>i===index?{...s,[field]:value}:s))}
 return <form action={action} className="cms-form"><h3>Editing /{page.slug}</h3>{['privacy','terms','cookies'].includes(page.slug)&&<p className="muted small" role="note">Legal document: have the content reviewed and approved before switching on publication. Saving a draft does not publish it unless the checkbox is selected.</p>}<input type="hidden" name="slug" value={page.slug}/>
  <label>Page heading<input name="title" defaultValue={page.title} maxLength={160} required/></label>
  <label>Eyebrow<input name="eyebrow" defaultValue={page.eyebrow} maxLength={2000}/></label>
  <label>Introduction<textarea name="description" rows={3} maxLength={2000} defaultValue={page.description}/></label>
  <h4>Page sections</h4><p className="muted small">Edit your headings and paragraphs below. No JSON or coding is needed.</p>
  {sections.map((section,index)=><section className="tax-panel" key={index} style={{marginBottom:12}}>
   <strong>Section {index+1}</strong>
   <label>Section heading<input aria-label={`Section ${index+1} heading`} required maxLength={180} value={section.heading} onChange={e=>editSection(index,'heading',e.target.value)}/></label>
   <label>Section text<textarea aria-label={`Section ${index+1} text`} rows={3} required maxLength={2000} value={section.body} onChange={e=>editSection(index,'body',e.target.value)}/></label>
   <button className="btn" type="button" onClick={()=>setSections(old=>old.filter((_,i)=>i!==index))}>Remove section</button>
  </section>)}
  <button className="btn" type="button" disabled={sections.length>=20} onClick={()=>setSections(old=>[...old,{heading:'',body:''}])}>+ Add section</button>
  <input type="hidden" name="sections" value={JSON.stringify(sections)}/>
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
  <label>Displayed price<input name="price_label" defaultValue={plan.price_label} maxLength={70}/></label>
  <label>Billing note<input name="billing_label" defaultValue={plan.billing_label} maxLength={2000}/></label>
  <label>Description<textarea name="description" defaultValue={plan.description} maxLength={2000}/></label>
  <label>Additional marketing notes (one per line)<textarea name="features" rows={6} maxLength={5000} defaultValue={Array.isArray(plan.features)?plan.features.join('\n'):''}/></label>
  <p className="small muted">Real module access and role permissions are managed separately under <a href="/admin/plan-access">Plan Access & Roles</a>. These notes never grant a feature automatically.</p>
  <label>CTA label<input name="cta_label" maxLength={90} defaultValue={plan.cta_label}/></label>
  <label>CTA path<input name="cta_url" defaultValue={plan.cta_url} pattern="/[a-z0-9/-]*"/></label>
  <label>Display order<input type="number" name="sort_order" min={0} max={1000} defaultValue={plan.sort_order}/></label>
  <label className="cms-check"><input name="published" type="checkbox" defaultChecked={plan.published}/> Published</label>
  <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Saving…':'Save plan'}</button>
  {state.message&&<span role="status" className={state.ok?'positive':'negative'}>{state.message}</span>}
 </form>;
}
