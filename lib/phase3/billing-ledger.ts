/** Read-only status interpretation. Neither a paid flag nor a page total proves Paystack settlement. */
export const BILLING_PAGE_SIZE=25;
export const validBusinessId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
export function validPage(v:unknown):number{
 if(typeof v!=='string'||!/^[1-9]\d{0,2}$/.test(v))return 1;
 const n=Number(v);return n<=100?n:1;
}
export function amountNGN(kobo:unknown):string{
 const raw=typeof kobo==='string'&&/^\d{1,16}$/.test(kobo)?BigInt(kobo):typeof kobo==='number'&&Number.isSafeInteger(kobo)&&kobo>=0?BigInt(kobo):null;
 if(raw===null||raw>9007199254740991n)return 'Amount unavailable';
 return new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(raw)/100);
}
export function paymentStatus(row:{status:string;created_at:string;paid_at?:string|null;paid_until?:string|null},now:number){
 if(row.status==='paid')return !row.paid_at||!row.paid_until?{label:'Paid record — review dates',alert:true}:{label:'Paid (database record)',alert:false};
 if(row.status==='failed')return {label:'Failed (database record)',alert:false};
 if(row.status!=='initiated')return {label:'Unknown state — investigate',alert:true};
 const age=now-Date.parse(row.created_at);
 return Number.isFinite(age)&&age>=3600000?{label:'Unconfirmed — review with Paystack',alert:true}:{label:'Awaiting verification',alert:false};
}
