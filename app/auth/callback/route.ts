import {NextRequest,NextResponse} from 'next/server';
import {getServerSupabase} from '@/lib/server/supabase';
export async function GET(request:NextRequest){
 const url=new URL(request.url);const code=url.searchParams.get('code');const token_hash=url.searchParams.get('token_hash');const type=url.searchParams.get('type');
 const safeNext=['/dashboard','/onboarding','/reset-password'].includes(url.searchParams.get('next')||'')?url.searchParams.get('next')!:'/dashboard';
 const client=await getServerSupabase();if(!client)return NextResponse.redirect(new URL('/login?error=config',url));
 if(code){const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(safeNext,url));}
 else if(token_hash&&type==='recovery'){const {error}=await client.auth.verifyOtp({token_hash,type:'recovery'});if(!error)return NextResponse.redirect(new URL('/reset-password',url));}
 return NextResponse.redirect(new URL('/login?error=callback',url));
}
