import {getWorkspace} from '@/lib/server/workspace';
import {createInvoicePdf} from '@/lib/pdf/invoice-pdf';
import type {InvoiceSnapshot} from '@/lib/invoice-document';
import {NextResponse} from 'next/server';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!UUID.test(id))return NextResponse.json({message:'Invoice not found.'},{status:404,headers:{'Cache-Control':'no-store'}});
 const {client,businessId}=await getWorkspace();
 try{
  // Always scope document reads by the authenticated business membership, never by an arbitrary URL parameter.
  const {data,error}=await client.from('business_invoices')
   .select('id,invoice_number,issued_at,snapshot')
   .eq('business_id',businessId).eq('id',id).maybeSingle();
  if(error)return NextResponse.json({message:'We could not prepare this invoice. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
  if(!data)return NextResponse.json({message:'Invoice not found.'},{status:404,headers:{'Cache-Control':'no-store'}});
  const result=createInvoicePdf({number:data.invoice_number,issuedAt:data.issued_at,snapshot:(data.snapshot||{}) as InvoiceSnapshot});
  const filename=`Invoice-${String(data.invoice_number).replace(/[^a-z0-9_-]/gi,'_').slice(0,65)||'document'}.pdf`;
  const body=result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength) as ArrayBuffer;
  return new NextResponse(body,{headers:{
   'Content-Type':'application/pdf',
   'Content-Disposition':`attachment; filename="${filename}"`,
   'Content-Length':String(result.byteLength),
   'Cache-Control':'private, no-store, max-age=0',
   'X-Content-Type-Options':'nosniff'
  }});
 }catch{
  return NextResponse.json({message:'We could not prepare this invoice. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
