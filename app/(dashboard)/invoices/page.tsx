'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {PageHead,Card,Button,Badge} from '@/components/ui';
import {Send} from '@/components/icons';
import {money} from '@/lib/format';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type Row={id:string;order_number:string;customer:string;total:number;paid:number;date:string};

export default function Invoices(){
  const router=useRouter();
  const{business,loading}=useBusiness();
  const[rows,setRows]=useState<Row[]>([]);

  useEffect(()=>{
    if(loading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const[{data:orders},{data:payments}]=await Promise.all([
        supabase.from('orders').select('id,order_number,total,created_at,customers(name)').eq('business_id',business.id).order('created_at',{ascending:false}),
        supabase.from('payments').select('order_id,amount,status').eq('business_id',business.id)
      ]);
      setRows((orders||[]).map((o:any)=>({id:o.id,order_number:o.order_number,customer:o.customers?.name||'Walk-in',total:Number(o.total),paid:(payments||[]).filter((p:any)=>p.order_id===o.id&&p.status==='completed').reduce((s:number,p:any)=>s+Number(p.amount),0),date:new Date(o.created_at).toLocaleDateString()})));
    })();
  },[business,loading]);

  if(!loading&&!business)return <div className="empty">Set up your business in Settings first.</div>;

  return <><PageHead title="Invoices & receipts" description="Professional documents generated from your orders and payments."/><Card><div className="table-wrap"><table className="table"><thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>{rows.map(i=>{const balance=Math.max(0,i.total-i.paid);const status=balance<=0?'Paid':i.paid>0?'Part paid':'Unpaid';return <tr key={i.id}><td>{i.order_number}</td><td>{i.customer}</td><td>{money(i.total)}</td><td>{money(i.paid)}</td><td>{money(balance)}</td><td><Badge tone={status==='Paid'?'success':status==='Part paid'?'warning':'default'}>{status}</Badge></td><td><Button onClick={()=>router.push(`/invoices/${i.id}`)}><Send size={14}/> View</Button></td></tr>})}</tbody></table>{rows.length===0&&<div className="empty">No orders yet — invoices are generated automatically from orders.</div>}</div></Card></>;
}
