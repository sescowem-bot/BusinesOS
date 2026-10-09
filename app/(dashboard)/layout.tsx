import {redirect} from 'next/navigation';
import {Shell} from '@/components/shell';
import {getPlatformBrand} from '@/lib/server/branding';
import {getServerSupabase} from '@/lib/server/supabase';
export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const client=await getServerSupabase();if(!client)redirect('/login');
 const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const {data:membership,error:memberError}=await client.from('business_members').select('business_id,role').eq('user_id',user.id).limit(1);
 if(memberError)throw new Error('Unable to verify your business workspace.');
 if(!membership?.length){
  const {data:admin}=await client.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle();
  if(admin)redirect('/admin');
  redirect('/onboarding');
 }
 const [{data:business},brand]=await Promise.all([client.from('businesses').select('name').eq('id',membership[0].business_id).maybeSingle(),getPlatformBrand()]);return <Shell brand={brand} businessName={business?.name||'My business'} businessRole={membership[0].role}>{children}</Shell>;
}
