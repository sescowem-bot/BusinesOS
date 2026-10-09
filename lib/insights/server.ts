import 'server-only';
import {getWorkspace} from '@/lib/server/workspace';
import {monthRange,summarize,generateInsights,type Order,type Payment,type Expense,type StockItem} from './engine';
export async function loadBusinessInsights(){
 const {client,businessId}=await getWorkspace();
 const now=new Date();const currentPeriod=monthRange(now),previousPeriod=monthRange(now,-1);
 const start=previousPeriod.from;
 // Outstanding balances require all historic orders and payments, not just this month.
 const [o,p,e,s]=await Promise.all([
 client.from('orders').select('id,customer_id,total,status,created_at,due_date').eq('business_id',businessId).limit(5000),
 client.from('payments').select('order_id,amount,status,paid_at').eq('business_id',businessId).limit(10000),
 client.from('expenses').select('amount,paid_at').eq('business_id',businessId).gte('paid_at',start).limit(5000),
 client.from('products').select('id,name,stock_quantity,minimum_stock,cost_price,track_inventory').eq('business_id',businessId).eq('active',true).limit(5000)
 ]);
 if(o.error||p.error||e.error||s.error)throw new Error('Insights source records could not be loaded');
 // Avoid displaying incomplete totals as definitive when record limits are reached.
 if((o.data||[]).length>=5000||(p.data||[]).length>=10000||(e.data||[]).length>=5000||(s.data||[]).length>=5000)throw new Error('Insights source data exceeds the current reporting limit; a paginated reporting service is required');
 const orders=(o.data||[]) as Order[],payments=(p.data||[]) as Payment[],expenses=(e.data||[]) as Expense[],stock=(s.data||[]) as StockItem[];
 const current=summarize(orders,payments,expenses,stock,currentPeriod,now),previous=summarize(orders,payments,expenses,stock,previousPeriod,now);
 return {current,previous,insights:generateInsights(current,previous),currentPeriod};
}
