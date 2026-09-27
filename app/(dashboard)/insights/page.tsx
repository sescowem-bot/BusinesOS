'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Card,PageHead,Section,Badge,Button} from '@/components/ui';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';
import {money} from '@/lib/format';
import {suggestedPrice,breakEvenUnits,installmentSchedule} from '@/lib/calculations';
import {TrendingUp,Users,Boxes,Calculator} from '@/components/icons';

export default function Insights(){
  const router=useRouter();
  const{business,loading}=useBusiness();
  const[sales,setSales]=useState(0);
  const[profit,setProfit]=useState(0);
  const[owingCount,setOwingCount]=useState(0);
  const[lowStockCount,setLowStockCount]=useState(0);

  const[pCost,setPCost]=useState('');const[pDirect,setPDirect]=useState('0');const[pMargin,setPMargin]=useState('30');
  const[beFixed,setBeFixed]=useState('');const[bePrice,setBePrice]=useState('');const[beCost,setBeCost]=useState('');
  const[iTotal,setITotal]=useState('');const[iDeposit,setIDeposit]=useState('0');const[iCount,setICount]=useState('3');

  useEffect(()=>{
    if(loading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const[{data:orders},{data:payments},{data:expenses},{data:products}]=await Promise.all([
        supabase.from('orders').select('total,status').eq('business_id',business.id),
        supabase.from('payments').select('amount,status,customer_id').eq('business_id',business.id),
        supabase.from('expenses').select('amount').eq('business_id',business.id),
        supabase.from('products').select('stock_quantity,minimum_stock').eq('business_id',business.id).eq('active',true)
      ]);
      const totalSales=(orders||[]).filter((o:any)=>o.status!=='cancelled').reduce((s:number,o:any)=>s+Number(o.total),0);
      const totalPaid=(payments||[]).filter((p:any)=>p.status==='completed').reduce((s:number,p:any)=>s+Number(p.amount),0);
      const totalExpenses=(expenses||[]).reduce((s:number,e:any)=>s+Number(e.amount),0);
      setSales(totalSales);
      setProfit(totalSales-totalExpenses);
      setOwingCount(totalSales>totalPaid?1:0);
      setLowStockCount((products||[]).filter((p:any)=>Number(p.stock_quantity)<=Number(p.minimum_stock)).length);
    })();
  },[business,loading]);

  if(!loading&&!business)return <div className="empty">Set up your business in Settings first.</div>;

  const price=pCost?suggestedPrice(Number(pCost)||0,Number(pDirect)||0,Number(pMargin)||0):null;
  const beUnits=beFixed&&bePrice?breakEvenUnits(Number(beFixed)||0,Number(bePrice)||0,Number(beCost)||0):null;
  let schedule:number[]|null=null;
  try{schedule=iTotal?installmentSchedule(Number(iTotal)||0,Number(iDeposit)||0,Number(iCount)||0):null}catch{schedule=null}

  return <><PageHead title="Business insights" description="Useful signals generated from the activity you record."/><div className="hero"><div className="tag">OVERVIEW</div><h2>Your business is moving forward.</h2><p>Sales of {money(sales)} have produced an estimated profit of {money(profit)} from the records currently in the workspace.</p></div><div style={{height:16}}/><div className="grid grid-3"><Card className="card-pad"><TrendingUp size={19}/><h3>Sales momentum</h3><p className="small muted">Total recorded sales so far: {money(sales)}.</p></Card><Card className="card-pad"><Users size={19}/><h3>Customer follow-up</h3><p className="small muted">{owingCount>0?'You have outstanding customer balances to follow up on.':'No outstanding balances right now.'}</p><Button onClick={()=>router.push('/customers')}>View customers</Button></Card><Card className="card-pad"><Boxes size={19}/><h3>Stock attention</h3><p className="small muted">{lowStockCount} product{lowStockCount===1?'':'s'} at or below minimum stock.</p><Button onClick={()=>router.push('/inventory')}>Review stock</Button></Card></div><div style={{height:16}}/><Section title="Useful calculators"><div className="grid grid-3"><Card className="card-pad"><Calculator size={18}/><h3>Pricing</h3><p className="small muted">Cost + direct costs + target margin.</p><div className="field"><label>Cost</label><input type="number" min="0" value={pCost} onChange={e=>setPCost(e.target.value)}/></div><div className="field"><label>Direct costs</label><input type="number" min="0" value={pDirect} onChange={e=>setPDirect(e.target.value)}/></div><div className="field"><label>Target margin %</label><input type="number" min="0" max="99" value={pMargin} onChange={e=>setPMargin(e.target.value)}/></div>{price!==null&&<p><b>Suggested price: {money(price)}</b></p>}</Card><Card className="card-pad"><Calculator size={18}/><h3>Break-even</h3><p className="small muted">Fixed costs ÷ average contribution per sale.</p><div className="field"><label>Fixed costs</label><input type="number" min="0" value={beFixed} onChange={e=>setBeFixed(e.target.value)}/></div><div className="field"><label>Selling price / unit</label><input type="number" min="0" value={bePrice} onChange={e=>setBePrice(e.target.value)}/></div><div className="field"><label>Variable cost / unit</label><input type="number" min="0" value={beCost} onChange={e=>setBeCost(e.target.value)}/></div>{beUnits!==null&&<p><b>{beUnits===Infinity?'Not achievable at this price':`${beUnits} units to break even`}</b></p>}</Card><Card className="card-pad"><Calculator size={18}/><h3>Installment</h3><p className="small muted">Split an order into scheduled payments.</p><div className="field"><label>Total amount</label><input type="number" min="0" value={iTotal} onChange={e=>setITotal(e.target.value)}/></div><div className="field"><label>Deposit</label><input type="number" min="0" value={iDeposit} onChange={e=>setIDeposit(e.target.value)}/></div><div className="field"><label>Number of installments</label><input type="number" min="1" value={iCount} onChange={e=>setICount(e.target.value)}/></div>{schedule&&<p className="small">{schedule.map((s,i)=><span key={i}>{money(s)}{i<schedule!.length-1?', ':''}</span>)}</p>}</Card></div></Section></>;
}
