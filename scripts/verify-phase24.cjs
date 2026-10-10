const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const checks={
 'supabase/migrations/022_issued_commercial_invoices.sql':[
  'CREATE TABLE public.business_invoices','UNIQUE(business_id, order_id)',
  'CREATE POLICY invoice_tenant_read','SECURITY DEFINER','FOR UPDATE',
  'CREATE TABLE public.business_invoice_counters','REVOKE ALL ON public.business_invoices'
 ],
 'app/(dashboard)/invoices/actions.ts':['issue_business_invoice','businessId'],
 'app/(dashboard)/invoices/issued/[id]/page.tsx':[".eq('business_id',businessId)",'invoice.snapshot'],
 'app/(dashboard)/invoices/page.tsx':['business_invoices','Issued commercial invoices'],
 'app/(dashboard)/orders/[id]/page.tsx':['IssueInvoiceForm','business_invoices']
};
for(const [file,phrases] of Object.entries(checks)){
 const contents=fs.readFileSync(path.join(root,file),'utf8');
 for(const phrase of phrases)if(!contents.includes(phrase))throw new Error(`Phase024 missing ${phrase} in ${file}`);
}
console.log('Phase 024 structural invariants present. Database transaction and RLS still require integration testing.');
