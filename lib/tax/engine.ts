/** Phase 08 provisional VAT estimate only. Approved classifications are required upstream. */
export type Treatment = 'standard' | 'zero_rated' | 'exempt' | 'outside_scope' | 'needs_review';
export type TaxLine = {name:string; quantity:string|number; unitPrice:string|number; treatment:Treatment; approved:boolean};
export type TaxResult = {lines:Array<{name:string;netMinor:bigint;vatMinor:bigint;treatment:Treatment}>;netMinor:bigint;vatMinor:bigint;totalMinor:bigint;status:'calculated'|'review_required'};
/** Convert a nonnegative decimal currency quantity to integer minor units without binary float arithmetic. */
export function minor(value:string|number):bigint {
 const s=String(value).trim();if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s))throw new Error('Invalid monetary amount');
 const [whole,fraction='']=s.split('.');return BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));
}
export function calculateVat(lines:TaxLine[],businessEligible:boolean):TaxResult {
 if(lines.length<1||lines.length>100)throw new Error('Provide 1 to 100 lines');
 let netMinor=0n,vatMinor=0n;let status:'calculated'|'review_required'='calculated';
 const mapped=lines.map(line=>{
 const q=Number(line.quantity);if(!Number.isSafeInteger(q)||q<1||q>1000000)throw new Error('Quantity must be a positive integer');
 const net=minor(line.unitPrice)*BigInt(q);if(net>100000000000000n)throw new Error('Line amount too large');
 const verified=line.approved&&line.treatment!=='needs_review'&&businessEligible;
 if(!verified)status='review_required';
 const vat=verified&&line.treatment==='standard'?(net*75n+500n)/1000n:0n;
 netMinor+=net;vatMinor+=vat;
 return {name:line.name,netMinor:net,vatMinor:vat,treatment:line.treatment};
 });
 return {lines:mapped,netMinor,vatMinor,totalMinor:netMinor+vatMinor,status};
}
export function formatMinor(value:bigint){return (Number(value)/100).toLocaleString('en-NG',{style:'currency',currency:'NGN'});}
