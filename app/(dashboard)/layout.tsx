import {Shell} from '@/components/shell';
import {getPlatformBrand} from '@/lib/server/branding';
import {getWorkspace} from '@/lib/server/workspace';
import {isActivePlatformAdmin} from '@/lib/server/viewer-access';
import {getWorkspaceVisibleModules} from '@/lib/server/visible-modules';
export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const perfStart=process.env.BUSINESSOS_PERF_DIAGNOSTICS==='true'?Date.now():null;
 const {client,businessId,role,userId}=await getWorkspace();
 const [{data:business,error},brand,notifications,isPlatformAdmin,visibility]=await Promise.all([
  client.from('businesses').select('name,logo_url').eq('id',businessId).maybeSingle(),
  getPlatformBrand(),
  client.from('user_notifications').select('id',{head:true,count:'exact'}).eq('recipient_id',userId).is('read_at',null),
  isActivePlatformAdmin(client,userId),
  getWorkspaceVisibleModules()
 ]);
 if(perfStart!==null)console.info('[businessos-perf] workspace shell queries ms:',Date.now()-perfStart);
 if(error)throw new Error('Business workspace details are unavailable. Contact support.');
 return <Shell brand={brand} businessName={business?.name||'My business'} businessLogo={business?.logo_url} businessRole={role} unreadCount={notifications.count||0} isPlatformAdmin={isPlatformAdmin} enabledFeatures={visibility.modules.filter((x):x is string=>typeof x==='string')}>{children}</Shell>;
}
