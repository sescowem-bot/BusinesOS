import Link from 'next/link';
import {getServerSupabase} from '@/lib/server/supabase';
import {redirect} from 'next/navigation';
import {updateNotificationRead,updateNotificationPreferences} from '@/app/(dashboard)/notifications/actions';
type Notice={id:string;title:string;body:string;priority:string;category:string;action_url:string|null;created_at:string;read_at:string|null};
export async function NotificationCentre(){
 const client=await getServerSupabase();if(!client)redirect('/login');
 const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const [result,prefs]=await Promise.all([
 client.from('user_notifications').select('id,title,body,priority,category,action_url,created_at,read_at').eq('recipient_id',user.id).order('created_at',{ascending:false}).limit(100),
 client.from('notification_preferences').select('*').eq('user_id',user.id).maybeSingle()
 ]);
 const notices=(result.data||[]) as Notice[];
 return <div className="tax-page"><p className="small muted">YOUR WORKSPACE</p><h1>Notifications</h1><p className="muted">Activity and important updates for your account. Only you can view these notifications.</p>
 {result.error?<section className="tax-panel" role="alert">Notification records are not available. Confirm migration 020 has been applied.</section>:<section className="tax-panel"><h2>Inbox <span className="badge">{notices.filter(n=>!n.read_at).length} unread</span></h2>{!notices.length?<p className="muted">No notifications yet. Important updates will appear here.</p>:notices.map(n=><div key={n.id} style={{borderBottom:'1px solid #e4e7ec',padding:'16px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'baseline',flexWrap:'wrap'}}><strong>{n.title}</strong><span className="small muted">{new Date(n.created_at).toLocaleString('en-NG')}</span></div><p className="small muted">{n.category} · {n.priority}{n.read_at?' · Read':' · Unread'}</p><p>{n.body}</p><div style={{display:'flex',gap:12,alignItems:'center'}}>{n.action_url&&<Link href={n.action_url} className="btn">View details</Link>}<form action={updateNotificationRead}><input type="hidden" name="id" value={n.id}/><input type="hidden" name="read" value={n.read_at?'false':'true'}/><button className="btn" type="submit">Mark {n.read_at?'unread':'read'}</button></form></div></div>)}</section>}
 <section className="tax-panel"><h2>Notification preferences</h2><p className="muted small">Essential security alerts may still be delivered regardless of marketing preferences.</p><form action={updateNotificationPreferences}><label className="field"><input type="checkbox" name="email_business" defaultChecked={prefs.data?.email_business??true}/> Business email notifications</label><label className="field"><input type="checkbox" name="email_marketing" defaultChecked={prefs.data?.email_marketing??false}/> Optional marketing emails</label><label className="field"><input type="checkbox" name="in_app_business" defaultChecked={prefs.data?.in_app_business??true}/> In-app business notifications</label><button type="submit" className="btn btn-primary">Save preferences</button></form></section></div>;
}
