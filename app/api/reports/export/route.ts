import {NextRequest,NextResponse} from 'next/server';
import {financialContext} from '@/lib/reporting/server';
import {csv} from '@/lib/reporting/financial';
export const dynamic='force-dynamic';

// PostgREST can cap query result sizes even when .limit() requests more rows.
// Never provide an incomplete CSV that could be mistaken for a complete ledger.
class IncompleteExportError extends Error {}
function requireComplete<T>(result:{data:T[]|null;count:number|null},label:string):T[]{
 if(result.count===null||result.data===null||result.data.length!==result.count)
  throw new IncompleteExportError(`${label} result is incomplete`);
 return result.data;
}

export async function GET(request:NextRequest){
 try{
  const kind=request.nextUrl.searchParams.get('kind');
  if(!['trial','ledger','tax-review'].includes(kind||''))return NextResponse.json({error:'Unknown report'},{status:400});
  const {client,businessId}=await financialContext();
  let rows:unknown[][]=[];
  if(kind==='trial'){
   const result=await client.from('gl_trial_balance').select('code,name,class,debit_turnover,credit_turnover,signed_balance',{count:'exact'}).eq('business_id',businessId).order('code').limit(10000);if(result.error)throw result.error;
   const data=requireComplete(result,'Trial balance');
   rows=[['Account code','Account name','Class','Debit turnover','Credit turnover','Signed balance'],...data.map(x=>[x.code,x.name,x.class,x.debit_turnover,x.credit_turnover,x.signed_balance])];
  }else if(kind==='ledger'){
   const jResult=await client.from('gl_journals').select('id,journal_date,reference,description,status',{count:'exact'}).eq('business_id',businessId).order('journal_date').limit(10000);if(jResult.error)throw jResult.error;
   const lResult=await client.from('gl_lines').select('journal_id,account_id,line_no,debit,credit,memo',{count:'exact'}).eq('business_id',businessId).order('line_no').limit(10000);if(lResult.error)throw lResult.error;
   const aResult=await client.from('gl_accounts').select('id,code,name',{count:'exact'}).eq('business_id',businessId).limit(10000);if(aResult.error)throw aResult.error;
   const journal=requireComplete(jResult,'Journals');
   const lines=requireComplete(lResult,'Journal lines');
   const accounts=requireComplete(aResult,'Chart of accounts');
   const jm=new Map(journal.map(x=>[x.id,x]));const am=new Map(accounts.map(x=>[x.id,x]));
   // Never silently omit orphaned lines: a broken relationship must block an export.
   if(lines.some(line=>!jm.has(line.journal_id)))throw new IncompleteExportError('Journal references cannot be reconciled');
   rows=[['Date','Reference','Journal description','Status','Account code','Account name','Debit','Credit','Line memo'],...lines.filter(l=>jm.has(l.journal_id)).map(l=>{const j=jm.get(l.journal_id)!;const a=am.get(l.account_id);return [j.journal_date,j.reference,j.description,j.status,a?.code||'',a?.name||'',l.debit,l.credit,l.memo]})];
  }else{
   const result=await client.from('tax_calculation_snapshots').select('id,tax_date,transaction_reference,status,created_at',{count:'exact'}).eq('business_id',businessId).order('tax_date',{ascending:false}).limit(10000);if(result.error)throw result.error;
   const data=requireComplete(result,'Tax review');
   rows=[['Tax date','Transaction reference','Review status','Calculation ID','Recorded at'],...data.map(x=>[x.tax_date,x.transaction_reference,x.status,x.id,x.created_at])];
  }
  const content=csv(rows);
  return new NextResponse(content,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${kind}-report.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){
  if(e instanceof IncompleteExportError)return NextResponse.json({error:'Export is incomplete because the dataset exceeds the available query rows or contains inconsistent journal references. No CSV was generated. Contact support for a complete export.'},{status:409,headers:{'Cache-Control':'private, no-store'}});
  return NextResponse.json({error:'Report unavailable or permission denied'},{status:403,headers:{'Cache-Control':'private, no-store'}});
 }
}
