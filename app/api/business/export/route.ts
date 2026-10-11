import {NextRequest,NextResponse} from 'next/server';
import {getWorkspace} from '@/lib/server/workspace';
import {csv} from '@/lib/reporting/financial';
export const dynamic='force-dynamic';
const HEADERS={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const BATCH=500;
const MAX_RECORDS=10000;
const configs={
 customers:{table:'business_customers',fields:'customer_id,status,created_at,customers(name,phone,email,address,notes)',order:'customer_id',head:['Name','Phone','Email','Address','Notes','Relationship status','Added']},
 products:{table:'products',fields:'name,sku,description,selling_price,cost_price,stock_quantity,minimum_stock,active,created_at,id',order:'id',head:['Product','SKU','Description','Selling price NGN','Cost price NGN','Stock quantity','Minimum stock','Active','Created']},
 orders:{table:'orders',fields:'order_number,status,subtotal,discount,tax,delivery_fee,total,due_date,created_at,id',order:'id',head:['Order number','Status','Subtotal NGN','Discount NGN','Tax NGN','Delivery NGN','Total NGN','Due date','Created']},
 payments:{table:'payments',fields:'order_id,amount,method,status,reference,paid_at,id',order:'id',head:['Order ID','Amount NGN','Method','Status','Reference','Paid on']},
 expenses:{table:'expenses',fields:'description,amount,paid_at,created_at,id',order:'id',head:['Description','Amount NGN','Paid on','Created']},
 invoices:{table:'business_invoices',fields:'invoice_number,order_id,issued_at,snapshot,id',order:'id',head:['Invoice number','Order ID','Issued at','Customer','Amount at issue NGN']}
} as const;
type Kind=keyof typeof configs;
function flatRows(kind:Kind,raw:Record<string,unknown>[]):unknown[][]{
 return raw.map(row=>{
  switch(kind){
   case 'customers':{const v=Array.isArray(row.customers)?row.customers[0]:row.customers;const c=(v||{}) as Record<string,unknown>;return [c.name,c.phone,c.email,c.address,c.notes,row.status,row.created_at];}
   case 'products':return [row.name,row.sku,row.description,row.selling_price,row.cost_price,row.stock_quantity,row.minimum_stock,row.active,row.created_at];
   case 'orders':return [row.order_number,row.status,row.subtotal,row.discount,row.tax,row.delivery_fee,row.total,row.due_date,row.created_at];
   case 'payments':return [row.order_id,row.amount,row.method,row.status,row.reference,row.paid_at];
   case 'expenses':return [row.description,row.amount,row.paid_at,row.created_at];
   case 'invoices':{const snap=(row.snapshot||{}) as {customer?:{name?:string};total?:number};return [row.invoice_number,row.order_id,row.issued_at,snap.customer?.name||'',snap.total??''];}
  }
 });
}
export async function GET(request:NextRequest){
 const kind=request.nextUrl.searchParams.get('kind');
 if(!kind||!(kind in configs))return NextResponse.json({message:'Choose a valid business report.'},{status:400,headers:HEADERS});
 try{
  const {client,businessId,role}=await getWorkspace();
  // Full customer exports are owner-controlled. Platform admins are NOT given data access.
  if(role!=='owner')return NextResponse.json({message:'Only the business owner can export all business records.'},{status:403,headers:HEADERS});
  const config=configs[kind as Kind];
  const records:Record<string,unknown>[]=[];
  for(let start=0;start<=MAX_RECORDS;start+=BATCH){
   const query=client.from(config.table).select(config.fields,{count:start===0?'exact':undefined})
    .eq('business_id',businessId).order(config.order,{ascending:true}).range(start,start+BATCH-1);
   const {data,error,count}=await query;
   if(error||!data)return NextResponse.json({message:'This export is unavailable. Please try again.'},{status:503,headers:HEADERS});
   if(start===0&&count!==null&&count>MAX_RECORDS)return NextResponse.json({message:'This record set needs a larger export. Please contact support for an archive.'},{status:409,headers:HEADERS});
   records.push(...data as Record<string,unknown>[]);
   if(records.length>MAX_RECORDS)return NextResponse.json({message:'This export is too large for a single download. Please contact support for an archive.'},{status:409,headers:HEADERS});
   if(data.length<BATCH)break;
  }
  const output=csv([Array.from(config.head),...flatRows(kind as Kind,records)]);
  return new NextResponse(output,{headers:{...HEADERS,'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':`attachment; filename="business-${kind}-${new Date().toISOString().slice(0,10)}.csv"`}});
 }catch(e){console.error('[business-export] failed',e instanceof Error?e.name:'unknown');
  return NextResponse.json({message:'The export could not be prepared. Please try again.'},{status:503,headers:HEADERS});}
}
