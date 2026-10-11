import {Shell} from '@/components/shell';
import {getPlatformBrand} from '@/lib/server/branding';
import {getWorkspace} from '@/lib/server/workspace';
import {isActivePlatformAdmin} from '@/lib/server/viewer-access';
export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const perfStart=process.env.BUSINESSOS_PERF_DIAGNOSTICS==='true'?Date.now():null;
 const {client,businessId,role,userId}=await getWorkspace();
 const [{data:business,error},brand,notifications,isPlatformAdmin,entitlements]=await Promise.all([
  client.from('businesses').select('name,logo_url').eq('id',businessId).maybeSingle(),
  getPlatformBrand(),
  client.from('user_notifications').select('id',{head:true,count:'exact'}).eq('recipient_id',userId).is('read_at',null),
  isActivePlatformAdmin(client,userId),
  client.rpc('business_workspace_features',{p_business:businessId})
 ]);
 if(perfStart!==null)console.info('[businessos-perf] workspace shell queries ms:',Date.now()-perfStart);
 if(error)throw new Error('Business workspace details are unavailable. Contact support.');
 return <Shell brand={brand} businessName={business?.name||'My business'} businessLogo={business?.logo_url} businessRole={role} unreadCount={notifications.count||0} isPlatformAdmin={isPlatformAdmin} enabledFeatures={Array.isArray(entitlements.data)?entitlements.data.filter((x):x is string=>typeof x==='string'):[]}>{children}</Shell>;
}
