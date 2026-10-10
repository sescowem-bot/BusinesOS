import {customerNameFromRelation} from '@/lib/customer-relations';
import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {OrderForm} from '../../sales/forms';
import {BusinessPageHeading,BusinessAlert} from '@/components/business-page-ui';
export const dynamic='force-dynamic';
export default async function NewOrder(){
 const {client,businessId}=await getWorkspace();
 const {data:links,error}=await client.from('business_customers').select('customer_id,customers(name)').eq('business_id',businessId).order('created_at',{ascending:false}).limit(500);
 if(error)return <div className="bo-page"><BusinessPageHeading eyebrow="SALES / NEW ORDER" title="Create a sales order" description="Record a customer order using real workspace data."/><BusinessAlert>Customers cannot be loaded. Please retry before creating an order.</BusinessAlert></div>;
 const customers=(links||[]).map(v=>({id:v.customer_id,name:customerNameFromRelation(v.customers, '')})).filter(c=>c.name);
 return <div className="bo-page bo-form-page"><BusinessPageHeading eyebrow="SALES / NEW ORDER" title="Create a sales order" description="Save a new order with the customer, item details and agreed amount. Payments can be recorded after the order is created."/><p className="bo-back-link"><Link href="/orders">← Back to orders</Link></p><section className="bo-form-panel"><div className="bo-form-head"><h2>Order details</h2><p>Confirm the customer and amounts carefully. The original order will be used for subsequent statements and invoices.</p></div>{customers.length?<OrderForm customers={customers}/>:<BusinessAlert>Add at least one customer before creating an order. <Link href="/customers/new">Create customer</Link>.</BusinessAlert>}{customers.length===500&&<p className="small muted">Only the most recent 500 customers are available here.</p>}</section></div>;
}
