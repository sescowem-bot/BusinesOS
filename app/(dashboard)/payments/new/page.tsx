'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Save} from 'lucide-react';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';
import {money} from '@/lib/format';

type OrderOpt={id:string;order_number:string;total:number;customer_id:string|null;customer_name:string;paid:number};

export default function NewPayment(){
  const router=useRouter();
  const{business}=useBusiness();
  const[orders,setOrders]=useState<OrderOpt[]>([]);
  const[orderId,setOrderId]=useState('');
  const[amount,setAmount]=useState('');
  const[method,setMethod]=useState('transfer');
  const[reference,setReference]=useState('');
  const[error,setError]=useState<string|null>(null);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    if(!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const[{data:ord},{data:pays}]=await Promise.all([
        supabase.from('orders').select('id,order_number,total,customer_id,customers(name)').eq('business_id',business.id).neq('status','cancelled').order('created_at',{ascending:false}),
        supabase.from('payments').select('order_id,amount,status').eq('business_id',business.id)
      ]);
      const withBalance=(ord||[]).map((o:any)=>{
        const paid=(pays||[]).filter((p:any)=>p.order_id===o.id&&p.status==='completed').reduce((s:number,p:any)=>s+Number(p.amount),0);
        return{id:o.id,order_number:o.order_number,total:Number(o.total),customer_id:o.customer_id,customer_name:o.customers?.name||'Walk-in',paid};
      }).filter((o:any)=>o.paid<o.total);
      setOrders(withBalance);
    })();
  },[business]);

  const selected=orders.find(o=>o.id===orderId);
  const balance=selected?Math.max(0,selected.total-selected.paid):0;

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    if(!business){setError('No business found for your account yet.');return}
    if(!selected){setError('Select an order to record a payment against.');return}
    const supabase=getSupabaseBrowser();
    if(!supabase){setError('Supabase is not configured.');return}
    setSaving(true);
    const{error:insErr}=await supabase.from('payments').insert({business_id:business.id,order_id:selected.id,customer_id:selected.customer_id,amount:Number(amount)||0,method,status:'completed',reference:reference||null});
    setSaving(false);
    if(insErr){setError(insErr.message);return}
    router.push('/payments');
    router.refresh();
  }

  return <><div className="page-head"><div><Link href="/payments" className="back-link"><ArrowLeft size={15}/> Payments</Link><h1>Record payment</h1><p>Log money received against an order.</p></div></div><form onSubmit={submit} className="form-card"><div className="form-grid"><div className="field full"><label>Order</label><select required value={orderId} onChange={e=>setOrderId(e.target.value)}><option value="">Select an order with an outstanding balance</option>{orders.map(o=><option key={o.id} value={o.id}>{o.order_number} — {o.customer_name} (balance {money(Math.max(0,o.total-o.paid))})</option>)}</select></div><div className="field"><label>Amount</label><input required type="number" min="0" max={balance||undefined} value={amount} onChange={e=>setAmount(e.target.value)} placeholder={balance?String(balance):'0'}/>{selected&&<span className="small muted">Balance due: {money(balance)}</span>}</div><div className="field"><label>Method</label><select value={method} onChange={e=>setMethod(e.target.value)}><option value="cash">Cash</option><option value="transfer">Transfer</option><option value="pos">POS</option><option value="card">Card</option><option value="online">Online</option><option value="other">Other</option></select></div><div className="field full"><label>Reference (optional)</label><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Transaction reference"/></div></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="form-actions"><Link href="/payments" className="btn">Cancel</Link><button className="btn btn-primary" type="submit" disabled={saving}><Save size={15}/> {saving?'Saving...':'Save payment'}</button></div></form></>;
}
