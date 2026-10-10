import {redirect} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/server/supabase';
import {getPlatformBrand} from '@/lib/server/branding';
import {AdminWorkspace} from '@/components/admin-workspace';
import './owner-console.css';

export const dynamic='force-dynamic';
/** The shared shell is server-gated; client-side menu visibility is not an access control. */
export default async function PlatformAdminLayout({children}:{children:React.ReactNode}){
 const session=await requirePlatformAdmin();
 if(!session)redirect('/login');
 const [brand,notifications]=await Promise.all([
  getPlatformBrand(),
  session.client.from('user_notifications').select('id',{count:'exact',head:true}).eq('recipient_id',session.user.id).is('read_at',null)
 ]);
 return <AdminWorkspace brand={brand} email={session.user.email||'Signed-in administrator'} unreadCount={notifications.error?null:notifications.count||0}>{children}</AdminWorkspace>;
}
