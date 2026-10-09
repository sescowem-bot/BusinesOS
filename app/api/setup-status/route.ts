import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
 let validUrl=false;
 try{const parsed=new URL(url);validUrl=parsed.protocol==='https:'&&!!parsed.hostname}catch{}
 return NextResponse.json({supabaseUrlConfigured:validUrl,supabasePublishableKeyConfigured:!!key,authReadyForAttempt:validUrl&&!!key,notice:'Checks environment variables only; does not verify connectivity, Auth settings or database migrations.'},{headers:{'Cache-Control':'no-store'}});
}
