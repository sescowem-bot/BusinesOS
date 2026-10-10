export type InvoiceSnapshot={
 seller?:{name?:string;address?:string;phone?:string;email?:string;currency?:string};
 customer?:{name?:string;address?:string;phone?:string;email?:string};
 invoice_identity?:{logo_url?:string;display_name?:string;registration_number?:string;tax_identification_number?:string;bank_name?:string;account_name?:string;account_number?:string;footer_note?:string};
 items?:Array<{description:string;quantity:number;unit_price:number;line_total:number}>;
 pos_pricing_context?:{price_mode:'exclusive'|'inclusive';discount_before_vat:number;subtotal_before_discount:number};
 pos_tax_lines?:Array<{product_name:string;treatment:'standard'|'zero_rated'|'exempt'|'outside_scope';rate_basis_points:number;taxable_base:number;vat_amount:number;rule_version_id:string;tax_date:string}>;
 tax_context?:{treatment:'standard'|'zero_rated'|'exempt'|'outside_scope';rate_basis_points:number;taxable_base:number;vat_amount:number;tax_date:string;rule_version_id:string};
 order_number?:string;order_due_date?:string|null;
 subtotal?:number;discount?:number;delivery_fee?:number;tax_recorded?:number;total?:number;paid_at_issue?:number;
};
export function invoiceTaxStatus(s:InvoiceSnapshot):{reviewed:boolean; label:string}{
 const pos=s.pos_tax_lines;
 if(Array.isArray(pos)&&pos.length>0){
  const valid=pos.every(l=>Number.isFinite(Number(l.vat_amount))&&Number.isFinite(Number(l.taxable_base))&&Number(l.taxable_base)>=0&&Number(l.vat_amount)>=0&&
   ((l.treatment==='standard'&&l.rate_basis_points===750)||(['zero_rated','exempt','outside_scope'].includes(l.treatment)&&l.rate_basis_points===0)));
  const sum=pos.reduce((a,l)=>a+Number(l.vat_amount||0),0);
  return valid&&Math.abs(sum-Number(s.tax_recorded||0))<0.01?{reviewed:true,label:'VAT (itemised, approved)'}:{reviewed:false,label:'Tax recorded (unverified)'};
 }
 const t=s.tax_context;
 if(!t||!['standard','zero_rated','exempt','outside_scope'].includes(t.treatment)||!Number.isFinite(Number(t.vat_amount))||Math.abs(Number(t.vat_amount)-Number(s.tax_recorded||0))>0.01)return {reviewed:false,label:'Tax recorded (unverified)'};
 if(t.treatment==='standard'&&t.rate_basis_points===750)return {reviewed:true,label:'VAT (7.5%)'};
 if(t.rate_basis_points===0&&t.treatment==='zero_rated')return {reviewed:true,label:'VAT (0%, zero-rated)'};
 if(t.rate_basis_points===0&&t.treatment==='exempt')return {reviewed:true,label:'VAT exempt'};
 if(t.rate_basis_points===0&&t.treatment==='outside_scope')return {reviewed:true,label:'Outside VAT scope'};
 return {reviewed:false,label:'Tax recorded (unverified)'};
}
export function invoiceTaxLabel(s:InvoiceSnapshot){return invoiceTaxStatus(s).label;}
export function invoiceMoney(value:unknown,currency?:string){
 const safe=typeof currency==='string'&&/^[A-Z]{3}$/.test(currency)?currency:'NGN';
 const n=Number(value);return new Intl.NumberFormat('en-NG',{style:'currency',currency:safe,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
}
