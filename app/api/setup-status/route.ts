import {NextResponse} from 'next/server';
import {requirePlatformAdmin} from '@/lib/server/supabase';
export const dynamic='force-dynamic';
export async function GET(){
 // Configuration diagnostics should only be visible to the Platform Owner.
 const admin=await requirePlatformAdmin();
 if(!admin)return NextResponse.json({error:'Access denied'},{status:403,headers:{'Cache-Control':'no-store'}});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
 let validUrl=false;
 try{const parsed=new URL(url);validUrl=parsed.protocol==='https:'&&!!parsed.hostname}catch{}
 return NextResponse.json({supabaseUrlConfigured:validUrl,supabasePublishableKeyConfigured:!!key,authReadyForAttempt:validUrl&&!!key,notice:'Checks environment variables only; does not verify connectivity, Auth settings or database migrations.'},{headers:{'Cache-Control':'no-store'}});
}
