'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {TablePage} from '@/components/table-page';
import {money} from '@/lib/format';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type Row={id:string;date:string;category:string;description:string;amount:number};

export default function Expenses(){
  const router=useRouter();
  const{business,loading:bizLoading}=useBusiness();
  const[rows,setRows]=useState<Row[]>([]);

  useEffect(()=>{
    if(bizLoading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const{data}=await supabase.from('expenses').select('id,description,amount,paid_at,expense_categories(name)').eq('business_id',business.id).order('paid_at',{ascending:false});
      setRows((data||[]).map((e:any)=>({id:e.id,date:new Date(e.paid_at).toLocaleDateString(),category:e.expense_categories?.name||'Uncategorized',description:e.description,amount:Number(e.amount)})));
    })();
  },[business,bizLoading]);

  if(!bizLoading&&!business)return <div className="empty">Set up your business in Settings before recording expenses.</div>;

  return <TablePage title="Expenses" description="Track the money your business spends and understand where it goes." rows={rows} addLabel="Add expense" onAdd={()=>router.push('/expenses/new')} columns={[{key:'date',label:'Date'},{key:'category',label:'Category'},{key:'description',label:'Description'},{key:'amount',label:'Amount',render:v=>money(Number(v))}]}/>;
}
