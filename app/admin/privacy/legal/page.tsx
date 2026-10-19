import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {LegalPublicationForm} from './review-form';
export const dynamic='force-dynamic';
export default async function LegalDocuments(){
 const session=await requirePlatformAdmin();
 if(!session)return null;
 const [{data:pages,error:pageError},{data:versions,error:versionError}]=await Promise.all([
  session.client.from('public_site_pages').select('slug,published,updated_at').in('slug',['terms','privacy','cookies']).order('slug'),
  session.client.from('legal_document_versions').select('document_key,version_label,effective_at,approved_at,reviewer_reference').order('created_at',{ascending:false}).limit(18)
 ]);
 return <main className="admin-area">
  <header className="admin-header"><div><span className="badge badge-brand">SYSTEM OWNER / LEGAL DOCUMENTS</span><h1>Reviewed policies &amp; acknowledgements</h1><p>Control evidence of approved document versions. Your public CMS page and the reviewed version must match before Terms acknowledgement becomes active.</p></div><Link className="btn" href="/admin/privacy">Privacy centre</Link></header>
  <div className="grid grid-2">
   <section className="card card-pad"><h2>Register a reviewed policy</h2><p className="small muted">Complete legal review first. Approved content must already appear on the corresponding published CMS page.</p><LegalPublicationForm/></section>
   <section className="card card-pad"><h2>Publication checklist</h2>
    <ol>
     <li>Confirm the legal company name, address, privacy contact and data handling statements.</li>
     <li>Have the exact policy text reviewed by a qualified adviser.</li>
     <li>Publish the approved text using the <Link href="/admin/content">website CMS</Link>.</li>
     <li>Register the approved version here with authentic review evidence.</li>
     <li>Review <Link href="/signup">signup</Link> and make sure the active Terms agreement appears.</li>
    </ol>
    <p className="small muted">This system cannot decide whether a policy is legally sufficient. False or unreviewed approval records must never be entered.</p>
   </section>
  </div>
  <section className="card card-pad" style={{marginTop:18}}><h2>CMS document status</h2>
   {pageError?<p role="alert">Could not load page statuses.</p>:
   <div className="grid grid-3">{(pages||[]).map(p=><div key={p.slug}><strong>{p.slug}</strong><p className="small muted">{p.published?'Published in CMS':'Draft / unpublished'}</p><Link href={'/admin/content/'+p.slug}>Edit document →</Link></div>)}</div>}
  </section>
  <section className="card card-pad" style={{marginTop:18}}><h2>Registered policy evidence</h2>
   {versionError?<p role="alert">Legal register unavailable. Verify database migration 051.</p>:
   !(versions||[]).length?<p className="small muted">No approved policies have been recorded.</p>:
   <div className="table-wrap"><table className="table"><thead><tr><th>Document</th><th>Version</th><th>Effective</th><th>Review reference</th></tr></thead><tbody>
   {(versions||[]).map((v,i)=><tr key={i}><td>{v.document_key}</td><td>{v.version_label}</td><td>{new Date(v.effective_at).toLocaleDateString('en-NG')}</td><td>{v.reviewer_reference||'Missing'}</td></tr>)}
   </tbody></table></div>}
  </section>
 </main>;
}
