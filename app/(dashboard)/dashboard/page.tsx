'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Metric} from '@/components/metric';
import {Card,Section,Button,Badge} from '@/components/ui';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';
import {money} from '@/lib/format';
import {ArrowUpRight,Calculator,ClipboardList,CreditCard,Plus,TrendingUp,Users,Wallet} from '@/components/icons';

export default function Dashboard(){
  const router=useRouter();
  const{business,loading}=useBusiness();
  const[sales,setSales]=useState(0);
  const[received,setReceived]=useState(0);
  const[owing,setOwing]=useState(0);
  const[profit,setProfit]=useState(0);
  const[hasActivity,setHasActivity]=useState(false);

  useEffect(()=>{
    if(loading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const[{data:orders},{data:payments},{data:expenses}]=await Promise.all([
        supabase.from('orders').select('total,status').eq('business_id',business.id),
        supabase.from('payments').select('amount,status').eq('business_id',business.id),
        supabase.from('expenses').select('amount').eq('business_id',business.id)
      ]);
      const totalSales=(orders||[]).filter((o:any)=>o.status!=='cancelled').reduce((s:number,o:any)=>s+Number(o.total),0);
      const totalReceived=(payments||[]).filter((p:any)=>p.status==='completed').reduce((s:number,p:any)=>s+Number(p.amount),0);
      const totalExpenses=(expenses||[]).reduce((s:number,e:any)=>s+Number(e.amount),0);
      setSales(totalSales);setReceived(totalReceived);
      setOwing(Math.max(0,totalSales-totalReceived));
      setProfit(totalSales-totalExpenses);
      setHasActivity((orders||[]).length>0||(payments||[]).length>0);
    })();
  },[business,loading]);

  const name=business?.name||'there';

  return <><div className="page-head"><div><div className="eyebrow">BUSINESS OVERVIEW</div><h1>Good morning, {name}</h1><p>Your workspace is ready. Start adding real business records to see your performance.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Button onClick={()=>router.push('/orders/new')}><Plus size={16}/> New sale</Button><Button primary onClick={()=>router.push('/payments/new')}><Plus size={16}/> Record payment</Button></div></div><div className="grid grid-4"><Metric label="Sales" value={money(sales)} meta="All time" icon={<TrendingUp size={18}/>}/><Metric label="Money received" value={money(received)} meta="Completed payments" icon={<CreditCard size={18}/>}/><Metric label="Customers owing" value={money(owing)} meta="Outstanding balances" icon={<Users size={18}/>}/><Metric label="Estimated profit" value={money(profit)} meta="Sales minus expenses" icon={<Calculator size={18}/>}/></div><div style={{height:16}}/><div className="grid grid-2">{hasActivity?<Card className="card-pad"><div className="subhead"><div><h2 className="section-title">Business performance</h2><div className="small muted">Your real activity so far</div></div><Badge tone="brand">Live</Badge></div><div className="empty compact"><TrendingUp size={26}/><p>Detailed charts are coming soon — keep recording orders and payments.</p></div></Card>:<Card className="card-pad"><div className="subhead"><div><h2 className="section-title">Business performance</h2><div className="small muted">Your real activity will appear here</div></div><Badge tone="brand">Ready</Badge></div><div className="empty compact"><TrendingUp size={26}/><p>Add your first order or payment to start seeing your business trend.</p><Button primary onClick={()=>router.push('/orders/new')}><Plus size={15}/> Add first transaction</Button></div></Card>}<Section title="Start here"><div className="list"><div className="list-row"><div><b>Add your first customer</b><div className="small muted">Save contact details and build customer history.</div></div><Button onClick={()=>router.push('/customers/new')}><Users size={15}/> Add</Button></div><div className="list-row"><div><b>Add a product or service</b><div className="small muted">Set pricing, cost and stock where relevant.</div></div><Button onClick={()=>router.push('/products/new')}><ClipboardList size={15}/> Add</Button></div><div className="list-row"><div><b>Record a business expense</b><div className="small muted">Track expenses so profit is calculated correctly.</div></div><Button onClick={()=>router.push('/expenses/new')}><Wallet size={15}/> Add</Button></div></div></Section></div><div style={{height:16}}/><Section title="What BusinessOS will calculate for you"><div className="insight-grid"><div><b>Sales</b><p className="small muted">Order values from completed business transactions.</p></div><div><b>Money received</b><p className="small muted">Only completed payments count as cash received.</p></div><div><b>Outstanding</b><p className="small muted">Order totals minus completed customer payments.</p></div><div><b>Estimated profit</b><p className="small muted">Sales minus product costs and recorded expenses.</p></div></div></Section></>;
}
