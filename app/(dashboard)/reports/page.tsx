'use client';
import {useEffect,useState} from 'react';
import {Card,PageHead,Section} from '@/components/ui';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';
import {money} from '@/lib/format';
import {Download} from '@/components/icons';

type ExpenseGroup={category:string;amount:number};

export default function Reports(){
  const{business,loading}=useBusiness();
  const[sales,setSales]=useState(0);
  const[cogs,setCogs]=useState(0);
  const[expenseTotal,setExpenseTotal]=useState(0);
  const[expenseGroups,setExpenseGroups]=useState<ExpenseGroup[]>([]);

  useEffect(()=>{
    if(loading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const[{data:orders},{data:items},{data:expenses}]=await Promise.all([
        supabase.from('orders').select('id,total,status').eq('business_id',business.id),
        supabase.from('order_items').select('quantity,unit_cost,order_id'),
        supabase.from('expenses').select('amount,expense_categories(name)').eq('business_id',business.id)
      ]);
      const validOrderIds=new Set((orders||[]).filter((o:any)=>o.status!=='cancelled').map((o:any)=>o.id));
      const totalSales=(orders||[]).filter((o:any)=>o.status!=='cancelled').reduce((s:number,o:any)=>s+Number(o.total),0);
      const totalCogs=(items||[]).filter((i:any)=>validOrderIds.has(i.order_id)).reduce((s:number,i:any)=>s+Number(i.quantity)*Number(i.unit_cost),0);
      const totalExpenses=(expenses||[]).reduce((s:number,e:any)=>s+Number(e.amount),0);
      const groups:Record<string,number>={};
      (expenses||[]).forEach((e:any)=>{const cat=e.expense_categories?.name||'Uncategorized';groups[cat]=(groups[cat]||0)+Number(e.amount)});
      setSales(totalSales);setCogs(totalCogs);setExpenseTotal(totalExpenses);
      setExpenseGroups(Object.entries(groups).map(([category,amount])=>({category,amount})).sort((a,b)=>b.amount-a.amount));
    })();
  },[business,loading]);

  if(!loading&&!business)return <div className="empty">Set up your business in Settings first.</div>;

  const grossProfit=sales-cogs;
  const profit=grossProfit-expenseTotal;

  return <><PageHead title="Reports" description="Clear business reports without accounting jargon." action={<button className="btn" onClick={()=>window.print()}><Download size={16}/> Export</button>}/><div className="grid grid-4"><Card className="card-pad"><span className="metric-label">Sales</span><div className="metric-value">{money(sales)}</div></Card><Card className="card-pad"><span className="metric-label">Product cost</span><div className="metric-value">{money(cogs)}</div></Card><Card className="card-pad"><span className="metric-label">Expenses</span><div className="metric-value">{money(expenseTotal)}</div></Card><Card className="card-pad"><span className="metric-label">Estimated profit</span><div className="metric-value">{money(profit)}</div></Card></div><div style={{height:16}}/><div className="grid grid-2"><Section title="Profit calculation"><div className="list"><div className="list-row"><span>Sales</span><b>{money(sales)}</b></div><div className="list-row"><span>Product cost</span><b className="negative">− {money(cogs)}</b></div><div className="list-row"><span>Gross profit</span><b>{money(grossProfit)}</b></div><div className="list-row"><span>Business expenses</span><b className="negative">− {money(expenseTotal)}</b></div><div className="list-row"><span><b>Estimated profit</b></span><b className="positive">{money(profit)}</b></div></div></Section><Section title="Expense breakdown">{expenseGroups.map(e=><div className="list-row" key={e.category}><span>{e.category}</span><b>{money(e.amount)}</b></div>)}{expenseGroups.length===0&&<p className="small muted">No expenses recorded yet.</p>}</Section></div><div className="footer-note">Profit is an estimate based on the sales, product costs and expenses recorded in the system.</div></>;
}
