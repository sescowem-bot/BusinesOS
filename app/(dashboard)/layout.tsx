import {Shell} from '@/components/shell';
import {getPlatformBrand} from '@/lib/server/branding';
import {getWorkspace} from '@/lib/server/workspace';
import {isActivePlatformAdmin} from '@/lib/server/viewer-access';
export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const {client,businessId,role,userId}=await getWorkspace();
 const [{data:business,error},brand,notifications,isPlatformAdmin]=await Promise.all([
  client.from('businesses').select('name').eq('id',businessId).maybeSingle(),
  getPlatformBrand(),
  client.from('user_notifications').select('id',{head:true,count:'exact'}).eq('recipient_id',userId).is('read_at',null),
  isActivePlatformAdmin(client,userId)
 ]);
 if(error)throw new Error('Business workspace details are unavailable. Contact support.');
 return <Shell brand={brand} businessName={business?.name||'My business'} businessRole={role} unreadCount={notifications.count||0} isPlatformAdmin={isPlatformAdmin}>{children}</Shell>;
}
