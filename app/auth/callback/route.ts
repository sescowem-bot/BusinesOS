import {NextRequest,NextResponse} from 'next/server';
import {getServerSupabase} from '@/lib/server/supabase';

const validNext=new Set(['/dashboard','/onboarding','/reset-password']);
const emailTypes=['signup','email','invite','magiclink','recovery','email_change'] as const;
type EmailVerificationType=(typeof emailTypes)[number];

export async function GET(request:NextRequest){
 const url=new URL(request.url);
 const code=url.searchParams.get('code');
 const tokenHash=url.searchParams.get('token_hash');
 const type=url.searchParams.get('type');
 const suppliedNext=url.searchParams.get('next')||'';
 const safeNext=validNext.has(suppliedNext)?suppliedNext:'/dashboard';
 const client=await getServerSupabase();
 if(!client)return NextResponse.redirect(new URL('/login?error=config',url));
 if(code){
  const {error}=await client.auth.exchangeCodeForSession(code);
  if(!error)return NextResponse.redirect(new URL(safeNext,url));
 }else if(tokenHash&&type&&emailTypes.includes(type as EmailVerificationType)){
  // An explicit finite whitelist avoids accepting arbitrary confirmation types or redirect URLs.
  const verifiedType=type as EmailVerificationType;
  const {error}=await client.auth.verifyOtp({token_hash:tokenHash,type:verifiedType});
  if(!error){
   const destination=verifiedType==='recovery'?'/reset-password':safeNext==='/reset-password'?'/dashboard':safeNext;
   return NextResponse.redirect(new URL(destination,url));
  }
 }
 return NextResponse.redirect(new URL('/login?error=callback',url));
}
