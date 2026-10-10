import {createServerClient} from '@supabase/ssr';
import {NextRequest,NextResponse} from 'next/server';

/**
 * Refreshes the Supabase session in a request context that can write cookies.
 * Without this Next.js Server Components may read an expired session but be
 * unable to persist a refreshed one, resulting in intermittent login loops.
 * The proxy is NOT an authorization boundary. Protected pages and actions
 * must always verify the user, role and tenant on the server.
 */
export async function proxy(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.next({request});
 let response=NextResponse.next({request});
 const supabase=createServerClient(url,key,{
  cookies:{
   getAll(){return request.cookies.getAll();},
   setAll(items){
    for(const item of items)request.cookies.set(item.name,item.value);
    response=NextResponse.next({request});
    for(const item of items)response.cookies.set(item.name,item.value,item.options);
   }
  }
 });
 // Refresh only; do not trust the proxy as a role/tenant permission check.
 try{await supabase.auth.getUser();}
 catch{/* Let protected routes return an explicit authentication error if the provider is unavailable. */}
 return response;
}

export const config={
 matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)']
};
