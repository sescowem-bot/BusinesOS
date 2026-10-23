import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {ArrowUpRight,BarChart3,ClipboardList,CreditCard,Package,Plus,Receipt,TrendingUp,Users,Wallet,ShieldCheck,Home} from '@/components/icons';
import './command-centre.css';
import {dashboardAccess,dashboardQuickActions,dashboardReportLinks,dashboardAttentionLinks} from '@/lib/dashboard-workflow';
export const dynamic='force-dynamic';

type RecentOrder={id:string;number:string;status:string;payment_status:string;total:number;received:number;due:number;created_at:string};
type RetailMargin={estimated_margin:number|null;net_sales:number|null;pos_orders:number;completed_credits:number};
type ManualMargin={estimated_margin:number;revenue_with_cost_evidence:number;cost:number;covered_orders:number;missing_cost_orders:number};
type DashboardSnapshot={period_start:string;role:string;sales:number;previous_sales:number;received:number;previous_received:number;
 expenses:number;previous_expenses:number;outstanding:number;orders:number;unpaid_count:number;partial_count:number;paid_count:number;
 overdue_count:number;low_stock:number;recent_orders:RecentOrder[];pos_profit:RetailMargin|null;manual_profit:ManualMargin|null};
const money=(n:unknown)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
const change=(now:number,prior:number)=>prior>0?Math.round(((now-prior)/prior)*100):null;
function Metric({label,value,description,icon:Icon,trend,href,featured=false}:{label:string;value:string;description:string;icon:typeof TrendingUp;trend?:number|null;href:string;featured?:boolean}){
 return <Link href={href} className={'command-metric'+(featured?' command-metric-featured':'')} aria-label={`${label}: ${value}; ${description}`}>
  <div className="command-metric-top"><span>{label}</span><span className="command-metric-icon"><Icon size={18}/></span></div>
  <strong className="command-metric-value">{value}</strong><div className="command-metric-bottom"><small>{description}</small>{trend!==null&&trend!==undefined&&<span className={trend<0?'negative':'positive'}>{trend>0?'+':''}{trend}%</span>}</div>
 </Link>;
}
const labelFor=(status:string)=>status==='Part paid'?'Part payment':status==='Paid'?'Paid in full':status;
function DashboardBody({d,role,features}:{d:DashboardSnapshot;role:string;features:string[]}){
 const access=dashboardAccess(role,features);
 const allowed=access.reports;
 const canViewExpenses=['owner','manager','finance'].includes(role);
 const canSeeSales=access.sales;
 const reportLinks=dashboardReportLinks(role,features);
 const quickActions=dashboardQuickActions(role,features);
 const profit=d.pos_profit?.estimated_margin;
 const manual=d.manual_profit;
 const estimatedTotal=Number(profit||0)+Number(manual?.estimated_margin||0);
 const covered=Number(manual?.covered_orders||0)+Number(d.pos_profit?.pos_orders||0);
 const costUnknown=Number(manual?.missing_cost_orders||0);
 const gross=Number(d.sales),received=Number(d.received),outstanding=Number(d.outstanding);
 const outstandingOrders=Number(d.unpaid_count)+Number(d.partial_count);
 const attentionLinks=dashboardAttentionLinks(role,features,outstandingOrders,Number(d.low_stock));
 const quickIcons={order:Plus,customer:Users,payments:CreditCard,product:Package,pos:Receipt,expenses:Wallet,inventory:Package,reports:BarChart3,team:Users,support:ShieldCheck,setup:Home};
 const items=[
  {label:'Sales this month',value:money(gross),description:'Total recorded orders, VAT included',icon:TrendingUp,href:'/orders',trend:change(gross,Number(d.previous_sales))},
  {label:'Payments received',value:money(received),description:'Completed payments this month',icon:CreditCard,href:'/payments',trend:change(received,Number(d.previous_received))},
  {label:'Outstanding customer balances',value:money(outstanding),description:`${outstandingOrders} unpaid or partly paid orders`,icon:Receipt,href:'/orders'},
  canViewExpenses?{label:'Paid business expenses',value:money(d.expenses),description:'This month’s expense records',icon:Wallet,href:'/expenses',trend:change(Number(d.expenses),Number(d.previous_expenses))}:{label:'Orders this month',value:Number(d.orders).toLocaleString('en-NG'),description:'Orders recorded this month',icon:ClipboardList,href:'/orders'}
 ];
 return <main className="command-centre">
  <header className="command-heading"><div><span className="command-kicker">BUSINESS PERFORMANCE / LIVE DATA</span><h1>Business command centre</h1><p>Sales, collections, outstanding orders and the decisions that need your attention.</p></div><div className="command-actions"><Link className="btn" href="/getting-started">Getting started</Link>{canSeeSales&&<Link className="btn" href="/orders">Manage orders <ArrowUpRight size={15}/></Link>}{canSeeSales&&<Link className="btn btn-primary" href="/orders/new"><Plus size={16}/> Create order</Link>}</div></header>
  <section className="command-hero" aria-label="Business performance at a glance"><div><span className="command-hero-label">MONTH-TO-DATE PERFORMANCE</span><h2>{canSeeSales?money(gross):'Access by role'}</h2><p>{canSeeSales?'Order value recorded this month. Payments, profit and cash balances are separate measures.':'Your workspace tools remain available. Financial amounts require an authorised sales or finance role.'}</p></div><div className="command-hero-actions">{reportLinks.length?reportLinks.map(link=><Link key={link.href} href={link.href}>{link.label} <ArrowUpRight size={15}/></Link>):<Link href="/getting-started">Explore your workspace <ArrowUpRight size={15}/></Link>}</div></section>
  {canSeeSales&&Number(d.orders)===0&&<section className="command-activation" aria-label="Start recording sales"><div><span className="command-kicker">NEXT ACTION</span><h2>No orders recorded this month</h2><p>Create an order when you have a confirmed sale. You can prepare customers and products first.</p></div><Link className="btn btn-primary" href="/getting-started">View getting started</Link></section>}
  {canSeeSales&&<section aria-label="Financial key performance indicators" className="command-metrics">{items.map(item=><Metric key={item.label} {...item}/>)}</section>}
  {canSeeSales&&<section className={"command-panel-grid"+(allowed?"":" command-single-column")}>
   {allowed&&<section className="command-panel command-profit"><div className="command-panel-head"><div><span className="command-kicker">PROFITABILITY</span><h2>Profit & margin overview</h2></div><Link href="/retail-reports" aria-label="Open profit report"><ArrowUpRight size={18}/></Link></div>
   {allowed&&d.pos_profit?<><div className="command-profit-total"><small>Estimated gross profit on covered sales</small><strong>{covered>0?money(estimatedTotal):'Not calculated'}</strong><span>POS margin plus manual orders with verified cost entries, before overhead</span></div><div className="command-profit-secondary"><div><span>Sales with cost evidence</span><strong>{covered.toLocaleString('en-NG')} orders</strong></div><div><span>Orders missing cost data</span><strong>{costUnknown.toLocaleString('en-NG')}</strong></div></div><p className="command-footnote">{Number(d.pos_profit.pos_orders)===0?"No eligible POS sales in this period. Historic manual orders need cost evidence. ":""}{costUnknown>0?`${costUnknown} manual orders have no recorded unit costs and are excluded. `:""}Estimated margin, not net business profit. Excludes manual-order cost gaps, operating expenses and accounting adjustments.</p></>:<div className="command-empty-state"><BarChart3 size={25}/><h3>Profit details not available</h3><p>{allowed?'Retail profit estimates require Financial Reporting access and recorded POS sales.':'Profit and cost data is restricted to owners, managers and finance users.'}</p>{allowed&&<Link href="/upgrade">Review reporting access</Link>}</div>}
   </section>}
   <section className="command-panel"><div className="command-panel-head"><div><span className="command-kicker">COLLECTIONS</span><h2>Order payment health</h2></div><Link href="/orders" aria-label="Review orders"><ArrowUpRight size={18}/></Link></div>
    <div className="command-payment-status"><Link href="/orders"><strong>{Number(d.unpaid_count)}</strong><span>Unpaid orders</span><i className="command-dot unpaid"/></Link><Link href="/orders"><strong>{Number(d.partial_count)}</strong><span>Partly paid orders</span><i className="command-dot part"/></Link><Link href="/orders"><strong>{Number(d.paid_count)}</strong><span>Fully paid orders</span><i className="command-dot paid"/></Link></div>
    <div className="command-collection-warning"><strong>{Number(d.overdue_count)} overdue orders</strong><p>Follow up on amounts past their recorded due dates.</p><Link href="/orders">Review balances <ArrowUpRight size={14}/></Link></div>
   </section>
  </section>}
  {canSeeSales&&<section className="command-panel command-orders"><div className="command-panel-head"><div><span className="command-kicker">ORDER CONTROL</span><h2>Recent customer orders</h2><p>Every order shows its payment status and remaining balance without opening another screen.</p></div><Link href="/orders">View all orders <ArrowUpRight size={15}/></Link></div>
   <div className="command-orders-table-wrap"><table className="command-orders-table"><thead><tr><th>Order</th><th>Value</th><th>Received</th><th>Balance due</th><th>Payment status</th><th>Details</th></tr></thead><tbody>{(d.recent_orders||[]).map(o=><tr key={o.id}><td data-label="Order"><Link href={`/orders/${o.id}`} className="command-order-id">{o.number||o.id.slice(0,8)}</Link><small>{new Date(o.created_at).toLocaleDateString('en-NG')}</small></td><td data-label="Value">{money(o.total)}</td><td data-label="Received">{money(o.received)}</td><td data-label="Balance due"><strong>{money(o.due)}</strong></td><td data-label="Payment status"><span className={'command-status '+(o.payment_status==='Paid'?'paid':o.payment_status==='Part paid'?'part':'unpaid')}>{labelFor(o.payment_status)}</span></td><td data-label="Details"><Link className="command-row-action" href={`/orders/${o.id}`}>Open <ArrowUpRight size={14}/></Link></td></tr>)}</tbody></table>{!d.recent_orders?.length&&<div className="command-empty-order"><ClipboardList size={22}/><p>No orders recorded yet.</p><Link href="/orders/new">Create your first order</Link></div>}</div>
  </section>}
  <div className="command-bottom-grid"><section className="command-panel"><div className="command-panel-head"><div><span className="command-kicker">PRIORITIES</span><h2>Needs attention</h2></div></div><div className="command-priority-list">{attentionLinks.map(link=>{const Icon=quickIcons[link.icon];return <Link key={link.href} href={link.href}><span className="command-priority-icon"><Icon size={17}/></span><span><strong>{link.label}</strong><small>{link.kind==='payments'?'Review unpaid and partly paid balances':link.kind==='stock'?'Check stock levels and purchasing':'Request help with your workspace'}</small></span><ArrowUpRight size={15}/></Link>})}</div></section>
  <section className="command-panel"><div className="command-panel-head"><div><span className="command-kicker">WORK FASTER</span><h2>Common actions</h2></div></div><div className="command-quick">{quickActions.map(link=>{const Icon=quickIcons[link.icon];return <Link href={link.href} key={link.href}><Icon size={18}/>{link.label}</Link>})}</div></section></div>
  <p className="command-disclaimer">Figures reflect saved orders, payments and expenses. Estimated sales margin is not final net profit. Reports use Lagos time. Account and branch access follow your business permissions.</p>
 </main>;
}
export default async function Dashboard(){
 const {client,businessId,role}=await getWorkspace();
 const [summary,entitlements]=await Promise.all([
  client.rpc('business_dashboard_command',{p_business:businessId}),
  client.rpc('business_workspace_features',{p_business:businessId})
 ]);
 const {data,error}=summary;
 const features=Array.isArray(entitlements.data)?entitlements.data.filter((x):x is string=>typeof x==='string'):[];
 if(entitlements.error)console.warn('[businessos-dashboard] feature visibility unavailable',{code:entitlements.error.code});
 if(error||!data){
  // including those affected by a report timeout or a membership/permission error.
  // Expose only a safe, actionable category, not Postgres internals or customer data.
  const code=error?.code||'UNAVAILABLE';
  console.warn('[businessos-dashboard] financial summary unavailable', {code});
  const missing=['PGRST202','42883'].includes(code);
  const denied=['42501','PGRST301'].includes(code);
  const timedOut=['57014','PGRST003','ETIMEDOUT'].includes(code);
  const explanation=missing
   ?'Your summary is temporarily unavailable. Please try again soon or contact support.'
   :denied
   ?'Your account could not access this financial summary. Ask the business owner or platform administrator to review your workspace access.'
   :timedOut
   ?'The financial report took too long to load. Please retry. Your saved orders and payments are not changed.'
   :'We couldn’t load your verified summary right now. Please try again or contact support.';
  return <main className="command-centre">
   <header className="command-heading"><div><span className="command-kicker">BUSINESS WORKSPACE</span><h1>Your business dashboard</h1><p>Other workspace pages remain available while reporting is being checked.</p></div>{dashboardAccess(role,features).sales?<Link href="/orders/new" className="btn btn-primary">Create an order</Link>:<Link href="/getting-started" className="btn btn-primary">Explore your tools</Link>}</header>
   <section className="command-panel" role="alert" aria-labelledby="dashboard-report-failure">
    <h2 id="dashboard-report-failure">Dashboard summary is temporarily unavailable</h2>
    <p>{explanation}</p>
    <p className="small muted">We are not displaying unverified financial amounts. Orders and payments can still be checked from their own registers.</p>
    <div className="command-actions"><Link href="/dashboard" prefetch={false} className="btn btn-primary">Retry dashboard</Link><Link href="/orders" className="btn">View orders</Link><Link href="/support" className="btn">Get help</Link></div>
   </section>
  </main>;
 }
 return <DashboardBody d={data as DashboardSnapshot} role={role} features={features}/>;
}
