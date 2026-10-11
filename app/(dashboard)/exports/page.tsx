import Link from 'next/link';
import {getWorkspace} from '@/lib/server/workspace';
import {PrintReportButton} from '@/components/print-report-button';
export const dynamic='force-dynamic';
const datasets=[
 ['customers','Customer contacts','Name, phone, email and notes'],
 ['products','Products and services','Prices, costs and stock quantities'],
 ['orders','Order history','Orders, totals and due dates'],
 ['payments','Payment records','Payment amounts, methods and references'],
 ['expenses','Expenses','Details, amounts and dates'],
 ['invoices','Issued invoices','Numbers, customers and recorded invoice amounts']
] as const;
export default async function Exports(){
 const {client,businessId,role}=await getWorkspace();
 const {data:business}=await client.from('businesses').select('name').eq('id',businessId).maybeSingle();
 const counts=role==='owner'?await Promise.all([
  client.from('business_customers').select('customer_id',{head:true,count:'exact'}).eq('business_id',businessId),
  client.from('products').select('id',{head:true,count:'exact'}).eq('business_id',businessId),
  client.from('orders').select('id',{head:true,count:'exact'}).eq('business_id',businessId),
  client.from('payments').select('id',{head:true,count:'exact'}).eq('business_id',businessId),
  client.from('expenses').select('id',{head:true,count:'exact'}).eq('business_id',businessId),
  client.from('business_invoices').select('id',{head:true,count:'exact'}).eq('business_id',businessId)
 ]):[];
 const owner=role==='owner';
 return <main className="tax-page bo-export-page"><div className="page-head"><div><h1>Export your business records</h1><p>Download your records for Excel, or print this page as a PDF for your files.</p></div>{owner&&<PrintReportButton/>}</div>
 {owner?<><section className="card card-pad"><h2>Download for Excel</h2><p className="muted small">Each file belongs only to your current business and opens in Excel or Google Sheets. These exports include up to 10,000 records per category; larger sets require a separate archive. Keep your downloaded files secure.</p><div className="grid grid-2">{datasets.map(([key,title,detail])=><div className="bo-export-item" key={key}><div><h3>{title}</h3><p className="small muted">{detail}</p></div><a className="btn" href={`/api/business/export?kind=${key}`} download>Download CSV</a></div>)}</div><p className="small muted">For trial balance, general ledger and VAT review schedules, use <Link href="/reports">Financial reports</Link> if included in your subscription.</p></section>
 <section className="card card-pad" style={{marginTop:18}}><h2>Printable business record cover sheet</h2><p><strong>Business:</strong> {business?.name||'My business'}</p><p><strong>Prepared:</strong> {new Date().toLocaleDateString('en-NG',{dateStyle:'long',timeZone:'Africa/Lagos'})}</p><p>This summary lists the number of records currently saved in your business. It does not calculate sales, profit or bank balances.</p><table className="table"><thead><tr><th>Business record type</th><th>Saved records</th></tr></thead><tbody>{datasets.map(([key,title],i)=><tr key={key}><td>{title}</td><td>{counts[i]?.error||counts[i]?.count===null?"Unavailable":counts[i]?.count??"Unavailable"}</td></tr>)}</tbody></table><p>To save as PDF, select <strong>Print / save as PDF</strong> above.</p><p className="muted small">For detailed transactions, download the Excel-compatible CSV files. This printable report provides record counts only and does not include private customer details.</p></section></>:<section className="card card-pad"><h2>Business records</h2><p>Only your business owner can download complete customer and financial records.</p><Link href="/dashboard" className="btn">Return to dashboard</Link></section>}
 </main>;
}
