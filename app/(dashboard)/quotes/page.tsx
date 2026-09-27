'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {PageHead,Card,Button,Badge} from '@/components/ui';
import {FileText,Plus,ArrowUpRight} from '@/components/icons';
import {money} from '@/lib/format';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type Row={id:string;quote_number:string;customer:string;total:number;status:string;date:string};

export default function Quotes(){
  const router=useRouter();
  const{business,loading}=useBusiness();
  const[rows,setRows]=useState<Row[]>([]);

  useEffect(()=>{
    if(loading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const{data}=await supabase.from('quotes').select('id,quote_number,total,status,created_at,customers(name)').eq('business_id',business.id).order('created_at',{ascending:false});
      setRows((data||[]).map((q:any)=>({id:q.id,quote_number:q.quote_number,customer:q.customers?.name||'—',total:Number(q.total),status:q.status,date:new Date(q.created_at).toLocaleDateString()})));
    })();
  },[business,loading]);

  if(!loading&&!business)return <div className="empty">Set up your business in Settings before creating quotes.</div>;

  return <><PageHead title="Quotes" description="Prepare professional quotes and convert accepted quotes into orders." action={<Button primary onClick={()=>router.push('/quotes/new')}><Plus size={16}/> New quote</Button>}/><Card><div className="table-wrap"><table className="table"><thead><tr><th>Quote</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>{rows.map(q=><tr key={q.id}><td><b>{q.quote_number}</b></td><td>{q.customer}</td><td>{money(q.total)}</td><td><Badge tone={q.status==='accepted'||q.status==='converted'?'success':q.status==='sent'?'brand':'default'}>{q.status}</Badge></td><td>{q.date}</td><td><Button onClick={()=>router.push(`/quotes/${q.id}`)}><ArrowUpRight size={14}/> Open</Button></td></tr>)}</tbody></table>{rows.length===0&&<div className="empty">No quotes yet.</div>}</div></Card></>;
}
