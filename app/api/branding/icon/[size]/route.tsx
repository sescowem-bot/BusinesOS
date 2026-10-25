import {ImageResponse} from 'next/og';
import {getPlatformBrand} from '@/lib/server/branding';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const SIZES=new Set([64,180,192,512]);

/** Only download known, public platform images, never an arbitrary operator-provided URL. */
async function getBrandImage(input:string):Promise<string|null>{
 if(!input||!process.env.NEXT_PUBLIC_SUPABASE_URL)return null;
 try{
  const url=new URL(input);
  const trusted=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if(url.protocol!=='https:'||url.origin!==trusted.origin||
     !url.pathname.startsWith('/storage/v1/object/public/platform-brand-assets/'))return null;
  const result=await fetch(url.toString(),{signal:AbortSignal.timeout(4000),next:{revalidate:86400}});
  if(!result.ok)return null;
  const mime=(result.headers.get('content-type')||'').split(';')[0].trim();
  if(!['image/png','image/jpeg','image/webp'].includes(mime))return null;
  const bytes=await result.arrayBuffer();
  if(bytes.byteLength===0||bytes.byteLength>1572864)return null;
  return 'data:'+mime+';base64,'+Buffer.from(bytes).toString('base64');
 }catch{return null;}
}

export async function GET(request:Request,{params}:{params:Promise<{size:string}>}){
 const size=Number((await params).size);
 if(!SIZES.has(size))return new Response('Unsupported icon size',{status:404});
 const brand=await getPlatformBrand();
 // Prefer a dedicated square favicon, then the public uploaded brand logo.
 const favicon=await getBrandImage(brand.favicon_url);
 const picture=favicon||await getBrandImage(brand.logo_url);
 const maskable=new URL(request.url).searchParams.get('maskable')==='1';
 const pad=maskable?Math.round(size*.18):Math.round(size*.105);
 const fontSize=Math.round(size*.57);
 const glyph=(brand.name.trim()[0]||'S').toLocaleUpperCase('en');
 const primary=/^#[0-9a-fA-F]{6}$/.test(brand.primary_color)?brand.primary_color:'#123B63';
 const accent=/^#[0-9a-fA-F]{6}$/.test(brand.accent_color)?brand.accent_color:'#16845B';
 return new ImageResponse(
  <div style={{height:'100%',width:'100%',display:'flex',alignItems:'center',justifyContent:'center',backgroundColor:primary,borderRadius:Math.round(size*.16),padding:pad}}>
   <div style={{height:'100%',width:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:Math.round(size*.12),backgroundColor:picture?'rgba(255,255,255,.11)':'rgba(255,255,255,.07)'}}>
    {picture?
     <img src={picture} alt="" width={size-pad*2} height={size-pad*2} style={{objectFit:'contain'}}/>:
     <span style={{display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontFamily:'sans-serif',fontWeight:800,fontSize,letterSpacing:-Math.round(size*.02),lineHeight:1}}>{glyph}</span>}
   </div>
   <div style={{position:'absolute',bottom:Math.round(size*.09),right:Math.round(size*.09),height:Math.max(3,Math.round(size*.055)),width:Math.max(3,Math.round(size*.055)),borderRadius:'50%',backgroundColor:accent}}/>
  </div>,{width:size,height:size,headers:{'Cache-Control':'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600','Content-Disposition':'inline; filename="businessos-brand-'+size+'.png"'}}
 );
}
