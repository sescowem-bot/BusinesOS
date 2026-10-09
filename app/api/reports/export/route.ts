import {NextRequest,NextResponse} from 'next/server';
import {financialContext} from '@/lib/reporting/server';
import {csv} from '@/lib/reporting/financial';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 try{
  const kind=request.nextUrl.searchParams.get('kind');
  if(!['trial','ledger','tax-review'].includes(kind||''))return NextResponse.json({error:'Unknown report'},{status:400});
  const {client,businessId}=await financialContext();
  let rows:unknown[][]=[];
  if(kind==='trial'){
   const {data,error}=await client.from('gl_trial_balance').select('code,name,class,debit_turnover,credit_turnover,signed_balance').eq('business_id',businessId).order('code');if(error)throw error;
   rows=[['Account code','Account name','Class','Debit turnover','Credit turnover','Signed balance'],...(data||[]).map(x=>[x.code,x.name,x.class,x.debit_turnover,x.credit_turnover,x.signed_balance])];
  }else if(kind==='ledger'){
   const {data:journal,error:e1}=await client.from('gl_journals').select('id,journal_date,reference,description,status').eq('business_id',businessId).order('journal_date');if(e1)throw e1;
   const {data:lines,error:e2}=await client.from('gl_lines').select('journal_id,account_id,line_no,debit,credit,memo').eq('business_id',businessId).order('line_no').limit(10000);if(e2)throw e2;
   const {data:accounts,error:e3}=await client.from('gl_accounts').select('id,code,name').eq('business_id',businessId);if(e3)throw e3;
   const jm=new Map((journal||[]).map(x=>[x.id,x]));const am=new Map((accounts||[]).map(x=>[x.id,x]));
   rows=[['Date','Reference','Journal description','Status','Account code','Account name','Debit','Credit','Line memo'],...(lines||[]).filter(l=>jm.has(l.journal_id)).map(l=>{const j=jm.get(l.journal_id)!;const a=am.get(l.account_id);return [j.journal_date,j.reference,j.description,j.status,a?.code||'',a?.name||'',l.debit,l.credit,l.memo]})];
  }else{
   const {data,error}=await client.from('tax_calculation_snapshots').select('id,tax_date,transaction_reference,status,created_at').eq('business_id',businessId).order('tax_date',{ascending:false}).limit(10000);if(error)throw error;
   rows=[['Tax date','Transaction reference','Review status','Calculation ID','Recorded at'],...(data||[]).map(x=>[x.tax_date,x.transaction_reference,x.status,x.id,x.created_at])];
  }
  const content=csv(rows);
  return new NextResponse(content,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${kind}-report.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return NextResponse.json({error:'Report unavailable or permission denied'},{status:403});}
}
