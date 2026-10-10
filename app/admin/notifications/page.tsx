import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {NotificationCentre} from '@/components/notification-centre';
export const dynamic='force-dynamic';
export default async function AdminNotifications(){
 const session=await requirePlatformAdmin();
 if(!session)return <main className="admin-area"><h1>Administrator access required</h1><Link href="/login">Sign in</Link></main>;
 return <main className="admin-area"><Link href="/admin">← System Owner</Link><NotificationCentre/></main>;
}
