import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {postTeamUpdate} from './actions';
export const dynamic='force-dynamic';
export default async function TeamUpdates(){
 const {client,businessId}=await getWorkspace();
 const [updatesResult,membersResult,labelsResult]=await Promise.all([
  client.from('business_team_updates').select('id,author_id,body,created_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(40),
  client.from('business_members').select('user_id,profiles(full_name)').eq('business_id',businessId).limit(150),
  client.from('business_member_labels').select('user_id,display_name').eq('business_id',businessId).limit(150)
 ]);
 const names=new Map((membersResult.data||[]).map(m=>[m.user_id,(m.profiles as unknown as {full_name?:string|null}|null)?.full_name||'Team member']));
 for(const label of labelsResult.data||[])names.set(label.user_id,label.display_name);
 return <main className="tax-page"><div className="page-head"><div><h1>Team updates</h1><p>Share internal announcements and handover notes with people in your business workspace.</p></div><Link className="btn" href="/team">Team & branches</Link></div>
  <div className="grid grid-2"><section className="card card-pad"><h2>Write an update</h2><form action={postTeamUpdate} className="comms-form"><label>Message<textarea name="message" required maxLength={2000} rows={5} placeholder="Share a shift update, staff instruction, or quick business announcement"/></label><button className="btn btn-primary" type="submit">Post to my team</button></form><p className="small muted">Only registered members of this business can see these updates. This is not customer chat or external messaging.</p></section>
  <section className="card card-pad"><h2>Recent team updates</h2>{updatesResult.error?<p role="alert">Updates are unavailable right now. Please try again.</p>:<div className="list">{(updatesResult.data||[]).map(x=><article className="list-row" key={x.id} style={{alignItems:'start',display:'block'}}><p><strong>{names.get(x.author_id)||'Team member'}</strong> <span className="muted small">· {new Date(x.created_at).toLocaleString('en-NG')}</span></p><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{x.body}</p></article>)}{!updatesResult.data?.length&&<p className="muted">No updates yet. Write the first note for your team.</p>}</div>}</section></div>
 </main>;
}
