'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {ArrowLeft,Printer} from 'lucide-react';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';
import {money} from '@/lib/format';

type Item={id:string;name_snapshot:string;quantity:number;unit_price:number;line_total:number};
type Payment={id:string;amount:number;method:string;paid_at:string};
type Order={order_number:string;subtotal:number;discount:number;tax:number;delivery_fee:number;total:number;created_at:string;customer_name:string};

export default function InvoiceDetail(){
  const params=useParams<{id:string}>();
  const{business}=useBusiness();
  const[order,setOrder]=useState<Order|null>(null);
  const[items,setItems]=useState<Item[]>([]);
  const[payments,setPayments]=useState<Payment[]>([]);

  useEffect(()=>{
    if(!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const{data:o}=await supabase.from('orders').select('order_number,subtotal,discount,tax,delivery_fee,total,created_at,customers(name)').eq('id',params.id).eq('business_id',business.id).maybeSingle();
      if(o)setOrder({order_number:o.order_number,subtotal:Number(o.subtotal),discount:Number(o.discount),tax:Number(o.tax),delivery_fee:Number(o.delivery_fee),total:Number(o.total),created_at:o.created_at,customer_name:(o as any).customers?.name||'Walk-in'});
      const[{data:its},{data:pays}]=await Promise.all([
        supabase.from('order_items').select('id,name_snapshot,quantity,unit_price,line_total').eq('order_id',params.id),
        supabase.from('payments').select('id,amount,method,paid_at').eq('order_id',params.id).eq('status','completed').order('paid_at')
      ]);
      setItems(its||[]);
      setPayments(pays||[]);
    })();
  },[business,params.id]);

  if(!order)return <div className="empty">Loading...</div>;
  const paid=payments.reduce((s,p)=>s+Number(p.amount),0);
  const balance=Math.max(0,order.total-paid);

  return <><div className="page-head no-print"><div><Link href="/invoices" className="back-link"><ArrowLeft size={15}/> Invoices</Link><h1>{order.order_number}</h1></div><button className="btn btn-primary" onClick={()=>window.print()}><Printer size={15}/> Print / Save PDF</button></div><div className="card-pad" style={{background:'#fff',border:'1px solid #eef0f3',borderRadius:12,maxWidth:640}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:24}}><div><b style={{fontSize:20}}>{business?.name}</b><p className="small muted">{business?.city}</p></div><div style={{textAlign:'right'}}><b>Invoice {order.order_number}</b><p className="small muted">{new Date(order.created_at).toLocaleDateString()}</p></div></div><p className="small muted">Billed to</p><b>{order.customer_name}</b><div style={{height:16}}/><table className="table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td>{i.name_snapshot}</td><td>{i.quantity}</td><td>{money(i.unit_price)}</td><td>{money(i.line_total)}</td></tr>)}</tbody></table><div style={{height:16}}/><div className="list"><div className="list-row"><span>Subtotal</span><b>{money(order.subtotal)}</b></div><div className="list-row"><span>Discount</span><b>− {money(order.discount)}</b></div><div className="list-row"><span>Tax</span><b>+ {money(order.tax)}</b></div><div className="list-row"><span>Delivery</span><b>+ {money(order.delivery_fee)}</b></div><div className="list-row"><span><b>Total</b></span><b>{money(order.total)}</b></div><div className="list-row"><span>Paid</span><b>{money(paid)}</b></div><div className="list-row"><span><b>Balance due</b></span><b>{money(balance)}</b></div></div></div></>;
}
