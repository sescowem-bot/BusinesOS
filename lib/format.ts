/** Preserve kobo when displaying NGN; stored money amounts are not changed. */
export function money(value:number,currency='NGN'){
 return new Intl.NumberFormat('en-NG',{
  style:'currency',currency,
  ...(currency==='NGN'?{minimumFractionDigits:2,maximumFractionDigits:2}:{})
 }).format(value);
}
export function number(value:number){return new Intl.NumberFormat('en-NG').format(value)}
