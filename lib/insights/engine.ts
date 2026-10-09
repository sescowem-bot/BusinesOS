/** Deterministic, data-backed insights. All monetary values use minor units (kobo). */
export type Order = {id:string;customer_id:string|null;total:number;status:string;created_at:string;due_date:string|null};
export type Payment = {order_id:string;amount:number;status:string;paid_at:string};
export type Expense = {amount:number;paid_at:string};
export type StockItem = {id:string;name:string;stock_quantity:number;minimum_stock:number;cost_price:number;track_inventory:boolean};
export type Period = {from:string;to:string};
export function toKobo(n:unknown){const v=Number(n);if(!Number.isFinite(v)||v<0)throw Error('Invalid nonnegative amount');return Math.round(v*100)}
export function monthRange(today:Date,monthOffset=0):Period{const y=today.getUTCFullYear(),m=today.getUTCMonth()+monthOffset;return {from:new Date(Date.UTC(y,m,1)).toISOString(),to:new Date(Date.UTC(y,m+1,1)).toISOString()}}
export function inPeriod(iso:string,p:Period){const v=Date.parse(iso);return Number.isFinite(v)&&v>=Date.parse(p.from)&&v<Date.parse(p.to)}
export function summarize(orders:Order[],payments:Payment[],expenses:Expense[],stock:StockItem[],period:Period,now:Date){
 const validOrders=orders.filter(o=>o.status!=='cancelled');
 const orderIds=new Set(validOrders.map(o=>o.id));
 const currentOrders=validOrders.filter(o=>inPeriod(o.created_at,period));
 const received=payments.filter(p=>p.status==='completed'&&orderIds.has(p.order_id)&&inPeriod(p.paid_at,period)).reduce((s,p)=>s+toKobo(p.amount),0);
 const sales=currentOrders.reduce((s,o)=>s+toKobo(o.total),0);
 const costs=expenses.filter(e=>inPeriod(e.paid_at,period)).reduce((s,e)=>s+toKobo(e.amount),0);
 const paidByOrder=new Map<string,number>();
 for(const payment of payments){if(payment.status!=='completed'||!orderIds.has(payment.order_id))continue;paidByOrder.set(payment.order_id,(paidByOrder.get(payment.order_id)||0)+toKobo(payment.amount))}
 const balances=validOrders.map(o=>({order:o,balance:Math.max(0,toKobo(o.total)-(paidByOrder.get(o.id)||0))}));
 const outstanding=balances.reduce((s,o)=>s+o.balance,0);
 const overdue=balances.filter(x=>x.balance>0&&!!x.order.due_date&&Date.parse(x.order.due_date+'T23:59:59Z')<now.getTime());
 const stockAlerts=stock.filter(s=>s.track_inventory&&Number(s.stock_quantity)<=Number(s.minimum_stock));
 const inventoryValue=stock.filter(s=>s.track_inventory).reduce((sum,s)=>sum+Math.round(Number(s.stock_quantity)*toKobo(s.cost_price)),0);
 const customers=new Set(currentOrders.map(o=>o.customer_id).filter(Boolean));
 return {sales,received,expenses:costs,outstanding,overdueCount:overdue.length,overdueAmount:overdue.reduce((s,x)=>s+x.balance,0),lowStock:stockAlerts,inventoryValue,orders:currentOrders.length,customers:customers.size,unreconciledSalesNotice:true};
}
export type Summary=ReturnType<typeof summarize>;
export function generateInsights(current:Summary,previous:Summary){const notes:{severity:'info'|'warning'|'positive';title:string;detail:string;href:string}[]=[];
 if(current.overdueCount)notes.push({severity:'warning',title:'Overdue customer balances',detail:`${current.overdueCount} orders have outstanding amounts past their due dates.`,href:'/orders'});
 if(current.lowStock.length)notes.push({severity:'warning',title:'Products need restocking',detail:`${current.lowStock.length} tracked products are at or below their minimum stock.`,href:'/inventory'});
 if(previous.sales>0){const change=Math.round((current.sales-previous.sales)/previous.sales*100);notes.push({severity:change>=0?'positive':'warning',title:'Sales movement',detail:`Sales ${change>=0?'increased':'decreased'} by ${Math.abs(change)}% against the previous calendar month, based on order creation dates.`,href:'/reports'})}
 else notes.push({severity:'info',title:'Build your sales history',detail:'A previous-month sales baseline is not available yet.',href:'/orders'});
 if(current.outstanding>0)notes.push({severity:'info',title:'Outstanding payments',detail:'Review unpaid customer orders and follow up where appropriate.',href:'/customers'});
 notes.push({severity:'info',title:'Cash and profit are different',detail:'Money received less recorded expenses is not accounting profit. Refer to posted ledger reports for financial results.',href:'/reports'});
 return notes;
}
