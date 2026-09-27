'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {TablePage,statusBadge} from '@/components/table-page';
import {money} from '@/lib/format';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type Row={id:string;order_number:string;customer:string;date:string;total:number;paid:number;balance:number;status:string};

export default function Orders(){
  const router=useRouter();
  const{business,loading:bizLoading}=useBusiness();
  const[rows,setRows]=useState<Row[]>([]);

  useEffect(()=>{
    if(bizLoading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const[{data:orders},{data:payments}]=await Promise.all([
        supabase.from('orders').select('id,order_number,total,status,created_at,customers(name)').eq('business_id',business.id).order('created_at',{ascending:false}),
        supabase.from('payments').select('order_id,amount,status').eq('business_id',business.id)
      ]);
      setRows((orders||[]).map((o:any)=>{
        const paid=(payments||[]).filter((p:any)=>p.order_id===o.id&&p.status==='completed').reduce((s:number,p:any)=>s+Number(p.amount),0);
        const total=Number(o.total);
        return{id:o.id,order_number:o.order_number,customer:o.customers?.name||'Walk-in',date:new Date(o.created_at).toLocaleDateString(),total,paid,balance:Math.max(0,total-paid),status:o.status};
      }));
    })();
  },[business,bizLoading]);

  if(!bizLoading&&!business)return <div className="empty">Set up your business in Settings before creating orders.</div>;

  return <TablePage title="Orders & sales" description="Track every order from creation to completion, including deposits and balances." rows={rows} addLabel="New order" onAdd={()=>router.push('/orders/new')} columns={[{key:'order_number',label:'Order'},{key:'customer',label:'Customer'},{key:'date',label:'Date'},{key:'total',label:'Order value',render:v=>money(Number(v))},{key:'paid',label:'Paid',render:v=>money(Number(v))},{key:'balance',label:'Balance',render:v=>money(Number(v))},{key:'status',label:'Status',render:v=>statusBadge(String(v))}]}/>;
}
