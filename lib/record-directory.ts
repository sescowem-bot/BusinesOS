/** Canonical, bounded query parameters for tenant-scoped record registers. */
export type DirectoryRaw={page?:string|string[];q?:string|string[];status?:string|string[];customer?:string|string[]};
export const DIRECTORY_SIZE=25;
const first=(v:string|string[]|undefined)=>typeof v==='string'?v:Array.isArray(v)?v[0]||'':'';
export const isUuid=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function parseDirectory(raw:DirectoryRaw){
 const p=first(raw.page);
 const parsed=/^[1-9]\d{0,5}$/.test(p)?Number(p):1;
 const page=Number.isSafeInteger(parsed)?Math.min(parsed,10000):1;
 // Reject characters that could alter PostgREST OR-filter grammar, wildcards or quotes.
 // Keep international names and ordinary contact details searchable.
 const q=first(raw.q).slice(0,80).replace(/[^\p{L}\p{N}\s@.+-]/gu,'').replace(/\s+/g,' ').trim();
 const status=first(raw.status).slice(0,24);
 const c=first(raw.customer);
 const customer=isUuid(c)?c:null;
 return {page,q,status,customer,offset:(page-1)*DIRECTORY_SIZE,size:DIRECTORY_SIZE};
}
export function directoryHref(route:string,options:{page?:number;q?:string;status?:string;customer?:string|null}){
 const p=new URLSearchParams();
 if(options.q)p.set('q',options.q);
 if(options.status)p.set('status',options.status);
 if(options.customer && isUuid(options.customer))p.set('customer',options.customer);
 if(options.page && options.page>1)p.set('page',String(options.page));
 const query=p.toString();
 return route+(query?'?'+query:'');
}
