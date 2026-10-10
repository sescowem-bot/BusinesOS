'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';

export type IssueInvoiceState={error:string;invoiceId:string};
export async function issueInvoice(_:IssueInvoiceState,form:FormData):Promise<IssueInvoiceState>{
  const orderId=String(form.get('order_id')||'');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(orderId)) return {error:'Invalid order reference.',invoiceId:''};
  try {
    const {client,businessId,role}=await getWorkspace();
    if(!['owner','manager','finance','sales'].includes(role)) return {error:'You do not have permission to issue invoices.',invoiceId:''};
    const {data,error}=await client.rpc('issue_business_invoice',{p_business:businessId,p_order:orderId});
    if(error){
      // Keep internal database details private. Expose only safe, actionable feedback.
      return {error:error.code==='42883'||error.code==='PGRST202'?'Invoice feature is not installed. Apply SQL migration 022.':
        error.code==='42501'?'Your role is not permitted to issue this invoice.':'Invoice could not be issued. Check the order status and try again.',invoiceId:''};
    }
    revalidatePath('/invoices');
    revalidatePath(`/orders/${orderId}`);
    return {error:'',invoiceId:String(data)};
  }catch{return {error:'Invoice could not be issued. Please try again.',invoiceId:''};}
}
