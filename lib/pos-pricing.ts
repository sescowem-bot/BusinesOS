/** Display-only pricing estimate. Postgres RPC is authoritative and revalidates all inputs. */
export type PosPriceMode='exclusive'|'inclusive';
export type PosPricingLine={product_id:string;quantity:number;price:number;rate:number};
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100);
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function previewPosPricing(lines:PosPricingLine[],mode:PosPriceMode,discount:number){
 const sorted=[...lines].sort((a,b)=>a.product_id.localeCompare(b.product_id));
 const calculated=sorted.map(line=>{
  const unitNet=mode==='inclusive'?money(line.price*10000/(10000+line.rate)):money(line.price);
  return {...line,unitNet,net:money(line.quantity*unitNet)};
 });
 const subtotal=money(calculated.reduce((s,l)=>s+l.net,0));
 const valid=Number.isFinite(discount)&&discount>=0&&discount<subtotal&&Number.isFinite(subtotal)&&subtotal>0;
 const applied=valid?money(discount):0;
 let balance=cents(applied);let remainingBase=cents(subtotal);let vat=0;
 const breakdown=calculated.map((line,i)=>{
  const base=cents(line.net);
  const remainingCapacity=remainingBase-base;
  const minimum=Math.max(0,balance-remainingCapacity);
  const ideal=cents(applied*line.net/subtotal);
  const portion=i===calculated.length-1?balance:Math.max(minimum,Math.min(balance,base,ideal));
  balance-=portion;remainingBase-=base;
  const taxable=money(line.net-portion/100);
  const tax=money(taxable*line.rate/10000);vat=money(vat+tax);
  return {...line,taxable,tax,discount:portion/100};
 });
 return {valid,subtotal,discount:applied,vat,total:money(subtotal-applied+vat),breakdown};
}
