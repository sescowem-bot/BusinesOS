/**
 * Exact-kobo staging reference, NOT a payment posting or authorization function.
 * Financial POS RPCs, invoices and refunds must be migrated atomically before
 * this calculation may become authoritative.
 */
export type VatMode='inclusive'|'exclusive';
export type VatLineInput={id:string;unitPrice:string;quantity:string;rateBasisPoints:number};
export type VatLine={id:string;quantity:string;rateBasisPoints:number;grossCents:bigint;netBeforeCents:bigint;vatBeforeCents:bigint;discountCents:bigint;netCents:bigint;vatCents:bigint;payableCents:bigint};
export type VatResult={lines:VatLine[];netCents:bigint;vatCents:bigint;payableCents:bigint;enteredGrossCents:bigint;discountCents:bigint;conserved:boolean};
const div=(a:bigint,b:bigint)=>{if(a<0n||b<=0n)throw new RangeError('Invalid amount');return (a*2n+b)/(b*2n)};
export function exactKobo(x:string):bigint{
 if(!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(x))throw new RangeError('Use a money string with at most two decimals');
 const [whole,dec='']=x.split('.');const n=BigInt(whole)*100n+BigInt(dec.padEnd(2,'0'));
 if(n>999999999999n)throw new RangeError('Amount exceeds PostgreSQL ledger limit');return n;
}
function quantityMillis(x:string):bigint{
 if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(x))throw new RangeError('Invalid quantity');
 const [whole,dec='']=x.split('.');const n=BigInt(whole)*1000n+BigInt(dec.padEnd(3,'0'));
 if(n===0n||n>999999000000n)throw new RangeError('Invalid quantity');return n;
}
export function allocateDiscount(weights:readonly bigint[],discount:bigint):bigint[]{
 const sum=weights.reduce((s,n)=>{if(n<0n)throw new RangeError('Invalid weight');return s+n},0n);
 if(sum<=0n||discount<0n||discount>=sum)throw new RangeError('Discount exceeds subtotal');
 const portions=weights.map(n=>discount*n/sum);
 let remaining=discount-portions.reduce((s,n)=>s+n,0n);
 const ranked=weights.map((n,i)=>({i,r:discount*n%sum})).sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1);
 for(const item of ranked){if(!remaining)break;portions[item.i]+=1n;remaining--;}
 if(remaining||portions.some((x,i)=>x>weights[i]))throw new RangeError('Discount allocation failed');
 return portions;
}
export function calculateVatLines(input:readonly VatLineInput[],mode:VatMode,discountText='0'):VatResult{
 if(mode!=='inclusive'&&mode!=='exclusive'||input.length<1||input.length>30)throw new RangeError('Invalid basket');
 const seen=new Set<string>();
 const base=input.map(line=>{
  if(!line.id||seen.has(line.id))throw new RangeError('Duplicate item');seen.add(line.id);
  if(!Number.isSafeInteger(line.rateBasisPoints)||line.rateBasisPoints<0||line.rateBasisPoints>10000)throw new RangeError('Invalid VAT rate');
  const grossEntered=div(exactKobo(line.unitPrice)*quantityMillis(line.quantity),1000n);
  if(grossEntered===0n)throw new RangeError('Line rounds to zero kobo');
  const rate=BigInt(line.rateBasisPoints);
  const net=mode==='inclusive'?div(grossEntered*10000n,10000n+rate):grossEntered;
  const vat=mode==='inclusive'?grossEntered-net:div(net*rate,10000n);
  return {line,grossEntered,net,vat};
 });
 const discount=exactKobo(discountText),alloc=allocateDiscount(base.map(x=>x.net),discount);
 const lines=base.map((row,i):VatLine=>{
  const net=row.net-alloc[i];
  const vat=alloc[i]===0n?row.vat:div(net*BigInt(row.line.rateBasisPoints),10000n);
  return {id:row.line.id,quantity:row.line.quantity,rateBasisPoints:row.line.rateBasisPoints,grossCents:row.grossEntered,netBeforeCents:row.net,vatBeforeCents:row.vat,discountCents:alloc[i],netCents:net,vatCents:vat,payableCents:net+vat};
 });
 const sum=(key:'grossCents'|'netCents'|'vatCents'|'payableCents')=>lines.reduce((n,x)=>n+x[key],0n);
 const gross=sum('grossCents'),net=sum('netCents'),vat=sum('vatCents'),payable=sum('payableCents');
 if([gross,net,vat,payable].some(n=>n>999999999999n))throw new RangeError('Totals exceed ledger bounds');
 return {lines,netCents:net,vatCents:vat,payableCents:payable,enteredGrossCents:gross,discountCents:discount,conserved:discount!==0n||mode==='exclusive'||gross===payable};
}
