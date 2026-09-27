import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';

const PROTECTED_PREFIXES=['/dashboard','/customers','/products','/orders','/payments','/expenses','/inventory','/quotes','/invoices','/reports','/insights','/tasks','/marketplace','/partners','/settings','/admin'];
const AUTH_PATHS=['/login','/signup'];

export async function proxy(request:NextRequest){
  let response=NextResponse.next({request});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return response;

  const supabase=createServerClient(url,key,{
    cookies:{
      getAll(){return request.cookies.getAll()},
      setAll(cookiesToSet){
        cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request});
        cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      }
    }
  });

  const{data:{user}}=await supabase.auth.getUser();
  const path=request.nextUrl.pathname;
  const isProtected=PROTECTED_PREFIXES.some(p=>path===p||path.startsWith(p+'/'));
  const isAuthPath=AUTH_PATHS.some(p=>path===p);

  if(!user&&isProtected){
    const redirectUrl=new URL('/login',request.url);
    redirectUrl.searchParams.set('next',path);
    return NextResponse.redirect(redirectUrl);
  }
  if(user&&isAuthPath){
    return NextResponse.redirect(new URL('/dashboard',request.url));
  }
  return response;
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
