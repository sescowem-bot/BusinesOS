/** Preserve kobo precision in cashier reconciliation; ordinary money() rounds to whole naira. */
export function formatCash(value:number){
 return new Intl.NumberFormat('en-NG',{
  style:'currency',currency:'NGN',minimumFractionDigits:2,maximumFractionDigits:2
 }).format(value);
}
