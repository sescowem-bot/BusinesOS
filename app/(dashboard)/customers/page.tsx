'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {TablePage,statusBadge} from '@/components/table-page';
import {money} from '@/lib/format';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type Row={id:string;name:string;phone:string;orders:number;total:number;paid:number;balance:number;status:string};

export default function Customers(){
  const router=useRouter();
  const{business,loading:bizLoading}=useBusiness();
  const[rows,setRows]=useState<Row[]>([]);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    if(bizLoading)return;
    if(!business){setLoading(false);return}
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase){setLoading(false);return}
      const[{data:links},{data:orders},{data:payments}]=await Promise.all([
        supabase.from('business_customers').select('customer_id,status,customers(id,name,phone)').eq('business_id',business.id),
        supabase.from('orders').select('customer_id,total,status').eq('business_id',business.id),
        supabase.from('payments').select('customer_id,amount,status').eq('business_id',business.id)
      ]);
      const result:Row[]=(links||[]).map((l:any)=>{
        const cust=l.customers;
        const custOrders=(orders||[]).filter((o:any)=>o.customer_id===cust?.id&&o.status!=='cancelled');
        const custPayments=(payments||[]).filter((p:any)=>p.customer_id===cust?.id&&p.status==='completed');
        const total=custOrders.reduce((s:number,o:any)=>s+Number(o.total),0);
        const paid=custPayments.reduce((s:number,p:any)=>s+Number(p.amount),0);
        const balance=Math.max(0,total-paid);
        return{id:cust?.id,name:cust?.name||'—',phone:cust?.phone||'—',orders:custOrders.length,total,paid,balance,status:balance>0?'Owing':(total>0?'Regular':'New')};
      });
      setRows(result);
      setLoading(false);
    })();
  },[business,bizLoading]);

  if(!bizLoading&&!business)return <div className="empty">Set up your business in Settings before adding customers.</div>;

  return <TablePage title="Customers" description="Know who buys from you, what they have paid and what they still owe." rows={rows} addLabel="New customer" searchPlaceholder="Search name, phone..." onAdd={()=>router.push('/customers/new')} columns={[{key:'name',label:'Customer'},{key:'phone',label:'Phone'},{key:'orders',label:'Orders'},{key:'total',label:'Purchases',render:v=>money(Number(v))},{key:'paid',label:'Paid',render:v=>money(Number(v))},{key:'balance',label:'Balance',render:v=>money(Number(v))},{key:'status',label:'Status',render:v=>statusBadge(String(v))}]}/>;
}
