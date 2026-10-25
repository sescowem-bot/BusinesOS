/** Public, stable icon URLs; an asset change creates a new cache key. */
export type BrandIconIdentity={name:string;logo_url:string;favicon_url:string;primary_color:string;accent_color:string};
export function brandIconVersion(brand:BrandIconIdentity):string{
 const input=[brand.name,brand.logo_url,brand.favicon_url,brand.primary_color,brand.accent_color].join('|');
 let value=2166136261;
 for(let i=0;i<input.length;i++)value=Math.imul(value^input.charCodeAt(i),16777619);
 return (value>>>0).toString(36);
}
export function brandIconPath(brand:BrandIconIdentity,size:64|180|192|512,maskable=false):string{
 const params=new URLSearchParams({v:brandIconVersion(brand)});
 if(maskable)params.set('maskable','1');
 return '/api/branding/icon/'+size+'?'+params.toString();
}
export function browserBrandIcon(brand:BrandIconIdentity):string{
 // ICO is a browser-native format, not reliably supported by the PNG image renderer.
 return /^https:\/\//.test(brand.favicon_url||'')&&/\.ico(?:[?#]|$)/i.test(brand.favicon_url)?brand.favicon_url:brandIconPath(brand,64);
}
