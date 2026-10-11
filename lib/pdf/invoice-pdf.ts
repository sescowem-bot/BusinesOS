/** Lightweight server-only invoice PDF writer. No browser screenshot, client storage, or third-party PDF service. */
import 'server-only';
import type {InvoiceSnapshot} from '@/lib/invoice-document';
import {invoiceTaxStatus} from '@/lib/invoice-document';

const WIDTH=595.28, HEIGHT=841.89;
const DARK='#143B5D', GREEN='#167451', PALE='#EFF5F9', LIGHT='#D9E4EB', MUTED='#557084';
type InvoiceData={number:string;issuedAt:string;snapshot:InvoiceSnapshot};
type Page={commands:string[]};
const ascii=(value:unknown)=>String(value??'').normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019]/g,"'")
 .replace(/[\u2013\u2014\u2212]/g,'-').replace(/[\u2022]/g,'/')
 .replace(/[\u20A6]/g,'NGN ').replace(/[^\x20-\x7E]/g,'?');
const esc=(value:unknown)=>ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const rgb=(hex:string)=>{const m=hex.replace('#','');return [0,2,4].map(i=>Number.parseInt(m.slice(i,i+2),16)/255).map(n=>n.toFixed(3)).join(' ')};
const num=(v:number)=>Number(v.toFixed(2));
const value=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
const fmt=(v:unknown,currency?:string)=>`${/^[A-Z]{3}$/.test(currency||'')?currency:'NGN'} ${value(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date=(v:unknown)=>{const d=new Date(String(v||''));return Number.isNaN(d.valueOf())?'':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})};
function lines(input:unknown,maxWidth:number,fontSize:number,maxRows=99){
 const result:string[]=[];
 const cleaned=ascii(input).replace(/\s+/g,' ').trim();
 let current='';
 const capacity=Math.max(8,Math.floor(maxWidth/(fontSize*.53)));
 for(const word of cleaned.split(' ')){
  if(!word)continue;
  if(word.length>capacity){
   if(current){result.push(current);current='';}
   let rest=word;
   while(rest.length>capacity){result.push(rest.slice(0,capacity));rest=rest.slice(capacity);}
   current=rest;
  }else if(!current){current=word;}
  else if(current.length+1+word.length<=capacity){current+=' '+word;}
  else{result.push(current);current=word;}
 }
 if(current)result.push(current);
 if(result.length>maxRows){const cropped=result.slice(0,maxRows);cropped[maxRows-1]=cropped[maxRows-1].slice(0,-3)+'...';return cropped;}
 return result.length?result:[''];
}
export function createInvoicePdf(input:InvoiceData):Buffer{
 const s=input.snapshot;
 const seller=s.seller||{},buyer=s.customer||{},identity=s.invoice_identity||{};
 const currency=seller.currency||'NGN';
 const pages:Page[]=[];let page:Page={commands:[]};let y=0;
 const write=(cmd:string)=>page.commands.push(cmd);
 function rect(x:number,top:number,w:number,h:number,fill:string){write(`${rgb(fill)} rg ${num(x)} ${num(HEIGHT-top-h)} ${num(w)} ${num(h)} re f`)}
 function rule(x:number,top:number,w:number,color=LIGHT){rect(x,top,w,0.7,color)}
 function text(x:number,top:number,str:unknown,size=10,color=DARK,bold=false){
  write(`BT /${bold?'F2':'F1'} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${num(x)} ${num(HEIGHT-top-size)} Tm (${esc(str)}) Tj ET`);
 }
 function right(x:number,top:number,str:unknown,size=10,color=DARK,bold=false){
  const string=ascii(str);const approx=string.length*size*(bold?.55:.52);
  text(Math.max(20,x-approx),top,string,size,color,bold);
 }
 function startPage(){
  page={commands:[]};pages.push(page);y=60;
  rect(0,0,WIDTH,8,DARK);
  rect(44,27,31,31,GREEN);text(55,32,ascii(identity.display_name||seller.name||'B').slice(0,1).toUpperCase(),19,'#FFFFFF',true);
  text(85,27,identity.display_name||seller.name||'Your business',14,DARK,true);
  text(85,46,'INVOICE',8,GREEN,true);
  right(WIDTH-44,30,input.number,13,DARK,true);
  rule(44,66,WIDTH-88);
  y=86;
 }
 function needs(height:number){if(y+height>HEIGHT-88)startPage()}
 
 startPage();
 text(44,y,'ISSUED TO',8,GREEN,true);
 text(320,y,'INVOICE DETAILS',8,GREEN,true);y+=20;
 const billed=[buyer.name||'Walk-in customer',buyer.address,buyer.email,buyer.phone].filter(Boolean);
 let left=y;
 for(const [i,line] of billed.entries()){for(const l of lines(line,244,i===0?11:9,2)){text(44,left,l,i===0?11:9,i===0?DARK:MUTED,i===0);left+=14;}}
 let rightY=y;for(const [label,v] of [['Issue date',date(input.issuedAt)],['Due date',s.order_due_date?date(`${s.order_due_date}T12:00:00Z`):'As agreed'],['Order',s.order_number||'']] as [string,string][]){if(!v)continue;text(320,rightY,label,9,MUTED);text(399,rightY,v,10,DARK,true);rightY+=18;}
 y=Math.max(left,rightY)+20;
 if(seller.address||seller.phone||seller.email){
  rect(44,y,WIDTH-88,53,PALE);
  const addr=[seller.address,seller.phone,seller.email].filter(Boolean).join('  /  ');
  lines(addr,WIDTH-120,9,3).forEach((l,i)=>text(55,y+10+i*12,l,9,MUTED));
  y+=69;
 }
 const items=Array.isArray(s.items)?s.items:[];
 function heading(){
  rect(44,y,WIDTH-88,28,DARK);
  text(55,y+7,'DESCRIPTION',9,'#FFFFFF',true);
  right(365,y+7,'QTY',9,'#FFFFFF',true);
  right(445,y+7,'UNIT PRICE',9,'#FFFFFF',true);
  right(WIDTH-55,y+7,'AMOUNT',9,'#FFFFFF',true);
  y+=32;
 }
 heading();
 if(!items.length){text(55,y+6,'No line items recorded',10,MUTED);y+=36;}
 for(const [index,item] of items.entries()){
  const descriptions=lines(item.description||'Product or service',250,9,5);
  const height=Math.max(29,14*descriptions.length+10);
  const remaining=items.length-index;
  if(y+height>HEIGHT-85 || (remaining<=5 && y+remaining*height+235>HEIGHT-85)){startPage();heading();}
  descriptions.forEach((line,i)=>text(55,y+5+i*14,line,9,DARK,i===0));
  right(365,y+5,String(value(item.quantity)),9);
  right(449,y+5,fmt(item.unit_price,currency),8);
  right(WIDTH-54,y+5,fmt(item.line_total,currency),8,DARK,true);
  rule(44,y+height-1,WIDTH-88);
  y+=height;
 }
 needs(190);y+=17;
 const totals:Array<[string,number,boolean]>=[['Subtotal',value(s.subtotal),false]];
 if(value(s.discount)>0)totals.push(['Discount',-value(s.discount),false]);
 if(value(s.delivery_fee)>0)totals.push(['Delivery',value(s.delivery_fee),false]);
 totals.push([invoiceTaxStatus(s).reviewed?invoiceTaxStatus(s).label:'Tax',value(s.tax_recorded),false]);
 totals.push(['Invoice total',value(s.total),true]);
 if(value(s.paid_at_issue)>0)totals.push(['Paid when issued',value(s.paid_at_issue),false]);
 totals.push(['Balance when issued',Math.max(0,value(s.total)-value(s.paid_at_issue)),true]);
 for(const [name,amount,em] of totals){
  if(em)rect(296,y-3,WIDTH-340,23,name==='Balance when issued'?PALE:'#E8F5EF');
  text(308,y+2,name,10,em?DARK:MUTED,em);
  right(WIDTH-54,y+2,(name==='Paid when issued'?'- ':'')+fmt(amount,currency),10,DARK,em);
  y+=27;
 }
 y+=12;
 const bank=[identity.bank_name,identity.account_name,identity.account_number].filter(Boolean);
 if(bank.length){needs(72);text(44,y,'PAYMENT DETAILS',9,GREEN,true);y+=19;bank.forEach(s=>{text(44,y,s,10,DARK);y+=14;});y+=9;}
 const regs=[identity.registration_number?`RC / BN: ${identity.registration_number}`:'',identity.tax_identification_number?`TIN: ${identity.tax_identification_number}`:''].filter(Boolean).join('  |  ');
 if(regs){needs(25);text(44,y,regs,8,MUTED);y+=18;}
 // Customer-facing footer: no developer disclaimers, database references, or claims of tax certification.
 const note=identity.footer_note||'Thank you for your business.';
 const notelines=lines(note,WIDTH-110,10,5);
 needs(21+notelines.length*14);
 rule(44,y+5,WIDTH-88);y+=17;
 notelines.forEach(line=>{text(44,y,line,10,DARK);y+=14;});
 for(let i=0;i<pages.length;i++){
  // Footer is part of the document; no browser URL, print timestamp or page header.
  page=pages[i];
  text(44,HEIGHT-43,`Invoice ${input.number}`,8,MUTED);
  right(WIDTH-44,HEIGHT-43,`Page ${i+1} of ${pages.length}`,8,MUTED);
 }
 const objects:string[]=[];
 const add=(str:string)=>{objects.push(str);return objects.length};
 const catalog=add('');const pagesId=add('');
 const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const pageIds:number[]=[];
 for(const p of pages){
  const stream=p.commands.join('\n')+'\n';
  const content=add(`<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}endstream`);
  const pageId=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`);
  pageIds.push(pageId);
 }
 objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
 objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(p=>`${p} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
 let output='%PDF-1.4\n%Invoice\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(Buffer.byteLength(output,'ascii'));
  output+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;
 }
 const xref=Buffer.byteLength(output,'ascii');
 output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const position of offsets.slice(1))output+=`${String(position).padStart(10,'0')} 00000 n \n`;
 output+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(output,'ascii');
}
