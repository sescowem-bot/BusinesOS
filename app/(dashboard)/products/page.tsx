'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {TablePage,statusBadge} from '@/components/table-page';
import {money} from '@/lib/format';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type Row={id:string;name:string;sku:string;category:string;price:number;cost:number;stock:number;status:string};

export default function Products(){
  const router=useRouter();
  const{business,loading:bizLoading}=useBusiness();
  const[rows,setRows]=useState<Row[]>([]);

  useEffect(()=>{
    if(bizLoading||!business)return;
    (async()=>{
      const supabase=getSupabaseBrowser();
      if(!supabase)return;
      const{data}=await supabase.from('products').select('id,name,sku,selling_price,cost_price,stock_quantity,minimum_stock,active,product_categories(name)').eq('business_id',business.id).order('created_at',{ascending:false});
      setRows((data||[]).map((p:any)=>({id:p.id,name:p.name,sku:p.sku||'—',category:p.product_categories?.name||'Uncategorized',price:Number(p.selling_price),cost:Number(p.cost_price),stock:Number(p.stock_quantity),status:!p.active?'Inactive':(Number(p.stock_quantity)<=Number(p.minimum_stock)?'Low stock':'Active')})));
    })();
  },[business,bizLoading]);

  if(!bizLoading&&!business)return <div className="empty">Set up your business in Settings before adding products.</div>;

  return <TablePage title="Products & services" description="Manage what you sell, pricing, cost and stock levels." rows={rows} addLabel="Add offering" searchPlaceholder="Search products..." onAdd={()=>router.push('/products/new')} columns={[{key:'name',label:'Name'},{key:'sku',label:'SKU'},{key:'category',label:'Category'},{key:'price',label:'Price',render:v=>money(Number(v))},{key:'cost',label:'Cost',render:v=>money(Number(v))},{key:'stock',label:'Stock'},{key:'status',label:'Status',render:v=>statusBadge(String(v))}]}/>;
}
