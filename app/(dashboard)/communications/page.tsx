import {requireBusinessFeature} from '@/lib/server/authorization';
import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {createConversation,addMessage} from './actions';
async function InternalProtectedPage({searchParams}:{searchParams:Promise<{thread?:string}>}){
 const {client,businessId}=await getWorkspace();const selected=(await searchParams).thread||'';
 const [{data:threads,error:threadError},{data:messages,error:messageError},{data:customers}]=await Promise.all([
 client.from('communication_conversations').select('id,subject,status,created_at').eq('business_id',businessId).order('created_at',{ascending:false}).limit(75),
 selected?client.from('communication_messages').select('id,body,channel,direction,status,created_at').eq('business_id',businessId).eq('conversation_id',selected).order('created_at',{ascending:true}).limit(200):Promise.resolve({data:[],error:null}),
 client.from('business_customers').select('customer_id').eq('business_id',businessId).limit(100)
 ]);
 const active=threads?.find(t=>t.id===selected);
 return <div className="comms-page"><div className="page-head"><div><h1>Inbox & Conversations</h1><p>Keep customer conversations and message drafts in one workspace.</p></div><Link className="btn" href="/communications/settings">Communication settings</Link></div>
 <div className="comms-layout"><section className="card card-pad"><h2 className="section-title">Conversations</h2>{threadError&&<p role="alert">Conversation list unavailable. Apply migration 011.</p>}
 <div className="comms-thread-list">{(threads||[]).map(t=><Link className={'comms-thread '+(active?.id===t.id?'selected':'')} href={'/communications?thread='+encodeURIComponent(t.id)} key={t.id}><strong>{t.subject}</strong><span className="muted small">{t.status} · {new Date(t.created_at).toLocaleDateString('en-NG')}</span></Link>)}{!threads?.length&&<p className="muted small">No conversations yet. Create one below.</p>}</div>
 <form action={createConversation} className="comms-form"><h3>New conversation</h3><label>Subject<input name="subject" required maxLength={180} placeholder="New customer enquiry"/></label><label>Customer (optional)<select name="customer_id"><option value="">No linked customer</option>{(customers||[]).map(c=><option value={c.customer_id} key={c.customer_id}>{c.customer_id}</option>)}</select></label><button className="btn btn-primary" type="submit">Create conversation</button></form></section>
 <section className="card card-pad"><h2 className="section-title">{active?.subject||'Select a conversation'}</h2>{active?<><div className="comms-messages">{messageError&&<p role="alert">Unable to load messages.</p>}{(messages||[]).map(m=><div className="comms-message" key={m.id}><div className="muted small">{m.channel.toUpperCase()} · {m.status} · {new Date(m.created_at).toLocaleString('en-NG')}</div><p>{m.body}</p></div>)}{!messages?.length&&<p className="muted">Start this conversation with a note or a draft.</p>}</div><form action={addMessage} className="comms-form"><input name="conversation_id" value={active.id} readOnly hidden/><label>Channel<select name="channel"><option value="internal">Internal note</option><option value="sms">SMS draft (not sent)</option><option value="email">Email draft (not sent)</option></select></label><label>Message<textarea name="body" rows={4} required maxLength={5000} placeholder="Write a message..."/></label><button className="btn btn-primary" type="submit">Save message</button><p className="muted small">SMS and email are saved as drafts only. No messages are transmitted.</p></form></>:<div className="empty">Select a conversation to view its messages. Chat with external customers is not live yet.</div>}</section></div></div>;
}

export default async function GuardedPage(){
 const check=await requireBusinessFeature('communications');
 if(!check.allowed)return <section className="tax-page"><h1>Access restricted</h1><p role="alert">{check.reason}</p><a className="btn" href="/upgrade">View available plans</a></section>;
 return <InternalProtectedPage/>;
}
