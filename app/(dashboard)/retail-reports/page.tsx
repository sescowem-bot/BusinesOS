import Link from 'next/link';
import {requireBusinessFeature} from '@/lib/server/authorization';
import {BusinessAlert,BusinessPageHeading,BusinessSection,BusinessSummary} from '@/components/business-page-ui';
export const dynamic='force-dynamic';
type Summary={orders:number;gross_order_total:number;net_sales_ex_vat_after_credits:number;vat_recorded:number;vat_credited:number;gross_credited:number;credit_count:number;recorded_payments_for_sold_orders:number;estimated_cost_net_returns:number;estimated_item_margin_ex_vat:number;unallocated_sale_count:number};
type Report={period_start:string;period_end:string;basis:string;summary:Summary;products:{product_id:string|null;product_name:string;net_units:number;net_sales_ex_vat:number;estimated_cost:number;estimated_margin:number}[];locations:{location:string;orders:number;gross_total:number}[]};
const ngn=(n:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T00:00:00Z').valueOf())&&new Date(v+'T00:00:00Z').toISOString().startsWith(v);
const diffDays=(a:string,b:string)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
const todayLagos=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export default async function RetailReports({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
 const access=await requireBusinessFeature('financial_reports');
 if(!access.allowed)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / RETAIL REPORTING" title="Retail performance" description="Management-only operational reports"/><BusinessAlert>{access.reason}</BusinessAlert></div>;
 const {role}=access;
 if(!['owner','manager','finance'].includes(role))return <div className="bo-page"><BusinessAlert>Owner, manager or finance permission is required to view retail margins.</BusinessAlert></div>;
 const supplied=await searchParams;
 const today=todayLagos();
 const defaultFrom=new Date(Date.parse(today+'T00:00:00Z')-29*86400000).toISOString().slice(0,10);
 const from=supplied.from||defaultFrom,to=supplied.to||today;
 const valid=validDate(from)&&validDate(to)&&diffDays(from,to)>=0&&diffDays(from,to)<=91&&to<=today;
 if(!valid)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / RETAIL REPORTING" title="Retail performance" description="POS activity by sale date"/><BusinessAlert>Select valid dates, with a reporting period of no more than 92 days, ending no later than today.</BusinessAlert><Link href="/retail-reports" className="btn">Reset dates</Link></div>;
 const {data,error}=await access.client.rpc('business_pos_management_report',{p_business:access.businessId,p_start:from,p_end:to});
 if(error||!data)return <div className="bo-page"><BusinessPageHeading eyebrow="OPERATIONS / RETAIL REPORTING" title="Retail performance" description="Indexed server-side POS reports"/><BusinessAlert>The report could not be loaded. Confirm SQL 041 and financial-reporting permissions. No figures will be shown until the database confirms them.</BusinessAlert></div>;
 const report=data as Report;
 const s=report.summary;
 return <div className="bo-page">
  <BusinessPageHeading eyebrow="OPERATIONS / RETAIL REPORTING" title="Retail performance" description="Fast, bounded management insights calculated by the database, not by downloading all POS transactions." action={{href:'/reports',label:'Financial statements'}}/>
  <form action="/retail-reports" method="get" className="bo-retail-filter"><label>Start date <input type="date" name="from" defaultValue={from} max={to}/></label><label>End date <input type="date" name="to" defaultValue={to} min={from} max={today}/></label><button className="btn btn-primary" type="submit">Update report</button></form>
  <BusinessAlert>Operational report, not a general-ledger profit and loss statement. Figures are grouped by the POS <strong>sale date</strong>; payments and completed credits for those sale orders may have occurred later. Unit costs are original sale snapshots and estimated margins exclude overhead, inventory revaluation, tax filing adjustments and unposted accounting events.</BusinessAlert>
  <BusinessSummary items={[{label:'POS sales',value:Number(s.orders).toLocaleString('en-NG'),detail:'Valid sale-date cohort'},{label:'Gross order value',value:ngn(Number(s.gross_order_total)),detail:'Including recorded VAT'},{label:'Net sales after credits',value:ngn(Number(s.net_sales_ex_vat_after_credits)),detail:'Excluding VAT; recorded returns deducted'},{label:'Estimated item margin',value:ngn(Number(s.estimated_item_margin_ex_vat)),detail:'Before overhead and accounting adjustments'},{label:'Completed credits',value:ngn(Number(s.gross_credited)),detail:`${s.credit_count} recorded returns`},{label:'Recorded payments',value:ngn(Number(s.recorded_payments_for_sold_orders)),detail:'For selected sale orders; not period cash flow'}]}/>
  {Number(s.unallocated_sale_count)>0&&<BusinessAlert>{s.unallocated_sale_count} POS sales were recorded without an assigned location. They are shown separately rather than attributed to an invented branch.</BusinessAlert>}
  <BusinessSection title="Top product movement" description="Highest net-sales product lines; limited to 20 aggregated products for predictable loading time."><div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Net units</th><th>Net sales ex VAT</th><th>Estimated cost</th><th>Estimated margin</th></tr></thead><tbody>{report.products.map((p,i)=><tr key={`${p.product_id||'legacy'}-${i}`}><td>{p.product_name}</td><td>{Number(p.net_units).toLocaleString('en-NG')}</td><td>{ngn(Number(p.net_sales_ex_vat))}</td><td>{ngn(Number(p.estimated_cost))}</td><td>{ngn(Number(p.estimated_margin))}</td></tr>)}</tbody></table></div>{!report.products.length&&<p className="muted">No eligible POS products in this period.</p>}</BusinessSection>
  <BusinessSection title="Location comparison" description="Gross POS order value for the chosen period, limited to the 20 highest-volume locations. Not branch-level profit or cash reconciliation."><div className="table-wrap"><table className="table"><thead><tr><th>Location</th><th>POS orders</th><th>Gross order value</th></tr></thead><tbody>{report.locations.map((l,i)=><tr key={`${l.location}-${i}`}><td>{l.location}</td><td>{Number(l.orders).toLocaleString('en-NG')}</td><td>{ngn(Number(l.gross_total))}</td></tr>)}</tbody></table></div>{!report.locations.length&&<p className="muted">No eligible POS sales recorded.</p>}</BusinessSection>
  <p className="small muted">Tax amount originally recorded: {ngn(Number(s.vat_recorded))} · VAT credited: {ngn(Number(s.vat_credited))}. These are source records, not a VAT return. For posted accounting balances, continue using <Link href="/reports">Financial reports</Link>.</p>
 </div>;
}
