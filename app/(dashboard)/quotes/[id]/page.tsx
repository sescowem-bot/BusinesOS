'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {Card,Badge,Button} from '@/components/ui';
import {useBusiness,nextOrderNumber} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';
import {money} from '@/lib/format';

type Item={id:string;name:string;quantity:number;unit_price:number};
type Quote={id:string;quote_number:string;status:string;subtotal:number;discount:number;tax:number;total:number;customer_id:string|null;customer_name:string};

export default function QuoteDetail(){
  const params=useParams<{id:string}>();
  const router=useRouter();
  const{business}=useBusiness();
  const[quote,setQuote]=useState<Quote|null>(null);
  const[items,setItems]=useState<Item[]>([]);
  const[error,setError]=useState<string|null>(null);
  const[busy,setBusy]=useState(false);

  async function load(){
    const supabase=getSupabaseBrowser();
    if(!supabase||!business)return;
    const{data:q}=await supabase.from('quotes').select('id,quote_number,status,subtotal,discount,tax,total,customer_id,customers(name)').eq('id',params.id).eq('business_id',business.id).maybeSingle();
    if(q)setQuote({id:q.id,quote_number:q.quote_number,status:q.status,subtotal:Number(q.subtotal),discount:Number(q.discount),tax:Number(q.tax),total:Number(q.total),customer_id:q.customer_id,customer_name:(q as any).customers?.name||'—'});
    const{data:its}=await supabase.from('quote_items').select('id,name,quantity,unit_price').eq('quote_id',params.id);
    setItems(its||[]);
  }

  useEffect(()=>{if(business)load()},[business,params.id]);

  async function setStatus(status:string){
    const supabase=getSupabaseBrowser();
    if(!supabase||!quote)return;
    await supabase.from('quotes').update({status}).eq('id',quote.id);
    load();
  }

  async function convertToOrder(){
    const supabase=getSupabaseBrowser();
    if(!supabase||!quote||!business)return;
    setBusy(true);setError(null);
    const{data:order,error:orderErr}=await supabase.from('orders').insert({business_id:business.id,customer_id:quote.customer_id,order_number:nextOrderNumber(),status:'new',subtotal:quote.subtotal,discount:quote.discount,tax:quote.tax,delivery_fee:0}).select('id').single();
    if(orderErr){setBusy(false);setError(orderErr.message);return}
    const itemRows=items.map(i=>({order_id:order.id,name_snapshot:i.name,quantity:i.quantity,unit_price:i.unit_price,unit_cost:0}));
    if(itemRows.length){
      const{error:itemsErr}=await supabase.from('order_items').insert(itemRows);
      if(itemsErr){setBusy(false);setError(itemsErr.message);return}
    }
    await supabase.from('quotes').update({status:'converted'}).eq('id',quote.id);
    setBusy(false);
    router.push('/orders');
    router.refresh();
  }

  if(!quote)return <div className="empty">Loading...</div>;

  return <><div className="page-head"><div><Link href="/quotes" className="back-link"><ArrowLeft size={15}/> Quotes</Link><h1>{quote.quote_number}</h1><p>{quote.customer_name}</p></div><Badge tone={quote.status==='accepted'||quote.status==='converted'?'success':'default'}>{quote.status}</Badge></div><Card><div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td>{i.name}</td><td>{i.quantity}</td><td>{money(i.unit_price)}</td><td>{money(i.quantity*i.unit_price)}</td></tr>)}</tbody></table></div></Card><div style={{height:16}}/><div className="list"><div className="list-row"><span>Subtotal</span><b>{money(quote.subtotal)}</b></div><div className="list-row"><span>Discount</span><b>− {money(quote.discount)}</b></div><div className="list-row"><span>Tax</span><b>+ {money(quote.tax)}</b></div><div className="list-row"><span><b>Total</b></span><b>{money(quote.total)}</b></div></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="form-actions">{quote.status==='draft'&&<Button onClick={()=>setStatus('sent')}>Mark as sent</Button>}{(quote.status==='sent'||quote.status==='draft')&&<Button onClick={()=>setStatus('accepted')}>Mark as accepted</Button>}{quote.status!=='converted'&&<Button primary onClick={convertToOrder} style={{opacity:busy?0.6:1}}><ArrowUpRight size={15}/> {busy?'Converting...':'Convert to order'}</Button>}</div></>;
}
