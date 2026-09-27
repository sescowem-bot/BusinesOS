'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Card,Badge,Button,PageHead} from '@/components/ui';
import {AlertTriangle,Plus} from '@/components/icons';
import {money} from '@/lib/format';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type Row={id:string;name:string;sku:string;stock:number;minStock:number;cost:number};

export default function Inventory(){
  const router=useRouter();
  const{business,loading}=useBusiness();
  const[rows,setRows]=useState<Row[]>([]);

  useEffect(()=>{
    if(loading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const{data}=await supabase.from('products').select('id,name,sku,stock_quantity,minimum_stock,cost_price').eq('business_id',business.id).eq('active',true).order('name');
      setRows((data||[]).map((p:any)=>({id:p.id,name:p.name,sku:p.sku||'—',stock:Number(p.stock_quantity),minStock:Number(p.minimum_stock),cost:Number(p.cost_price)})));
    })();
  },[business,loading]);

  if(!loading&&!business)return <div className="empty">Set up your business in Settings before tracking inventory.</div>;

  const value=rows.reduce((a,p)=>a+p.stock*p.cost,0);
  const lowStock=rows.filter(p=>p.stock<=p.minStock).length;

  return <><PageHead title="Inventory" description="Know what is in stock, what it is worth and what needs restocking." action={<Button primary onClick={()=>router.push('/inventory/adjust')}><Plus size={16}/> Stock adjustment</Button>}/><div className="grid grid-3"><Card className="card-pad"><span className="metric-label">Stock value</span><div className="metric-value">{money(value)}</div></Card><Card className="card-pad"><span className="metric-label">Products tracked</span><div className="metric-value">{rows.length}</div></Card><Card className="card-pad"><span className="metric-label">Low stock</span><div className="metric-value">{lowStock}</div></Card></div><div style={{height:16}}/><Card><div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>SKU</th><th>On hand</th><th>Minimum</th><th>Stock value</th><th>State</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.sku}</td><td>{p.stock}</td><td>{p.minStock}</td><td>{money(p.stock*p.cost)}</td><td>{p.stock<=p.minStock?<Badge tone="warning"><AlertTriangle size={12}/> Restock</Badge>:<Badge tone="success">Healthy</Badge>}</td></tr>)}</tbody></table>{rows.length===0&&<div className="empty">No products tracked yet.</div>}</div></Card></>;
}
