'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {PageHead,Card,Button,Section} from '@/components/ui';
import {money} from '@/lib/format';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';
import {Plus,Send} from '@/components/icons';

type Row={id:string;order:string;customer:string;amount:number;method:string;date:string};

export default function Payments(){
  const router=useRouter();
  const{business,loading:bizLoading}=useBusiness();
  const[payments,setPayments]=useState<Row[]>([]);
  const[outstanding,setOutstanding]=useState(0);

  useEffect(()=>{
    if(bizLoading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const[{data:pays},{data:orders}]=await Promise.all([
        supabase.from('payments').select('id,amount,method,paid_at,orders(order_number),customers(name)').eq('business_id',business.id).order('paid_at',{ascending:false}),
        supabase.from('orders').select('total,status').eq('business_id',business.id)
      ]);
      setPayments((pays||[]).map((p:any)=>({id:p.id,order:p.orders?.order_number||'—',customer:p.customers?.name||'Walk-in',amount:Number(p.amount),method:p.method,date:new Date(p.paid_at).toLocaleDateString()})));
      const totalOrders=(orders||[]).filter((o:any)=>o.status!=='cancelled').reduce((s:number,o:any)=>s+Number(o.total),0);
      const totalPaid=(pays||[]).reduce((s:number,p:any)=>s+Number(p.amount),0);
      setOutstanding(Math.max(0,totalOrders-totalPaid));
    })();
  },[business,bizLoading]);

  if(!bizLoading&&!business)return <div className="empty">Set up your business in Settings before recording payments.</div>;

  return <><PageHead title="Payments" description="Record money received and keep customer balances accurate." action={<Button primary onClick={()=>router.push('/payments/new')}><Plus size={16}/> Record payment</Button>}/><div className="grid grid-3"><Card className="card-pad"><span className="metric-label">Total received</span><div className="metric-value">{money(payments.reduce((a,p)=>a+p.amount,0))}</div></Card><Card className="card-pad"><span className="metric-label">Outstanding</span><div className="metric-value">{money(outstanding)}</div></Card><Card className="card-pad"><span className="metric-label">Payments recorded</span><div className="metric-value">{payments.length}</div></Card></div><div style={{height:16}}/><Section title="Payment history"><div className="table-wrap"><table className="table"><thead><tr><th>Customer</th><th>Order</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{p.customer}</td><td>{p.order}</td><td>{money(p.amount)}</td><td>{p.method}</td><td>{p.date}</td></tr>)}</tbody></table>{payments.length===0&&<div className="empty">No payments recorded yet.</div>}</div></Section></>;
}
