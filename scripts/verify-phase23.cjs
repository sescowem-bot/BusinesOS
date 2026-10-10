const fs=require('fs');const path=require('path');
const root=process.cwd();
const entries=[['app/admin/page.tsx','Manage Website'],['app/admin/page.tsx','Manage Businesses'],['app/admin/website/page.tsx','requirePlatformAdmin'],['app/admin/businesses/page.tsx','requirePlatformAdmin'],['components/public-nav.tsx',"access==='admin'"],['components/shell.tsx','isPlatformAdmin'],['app/(dashboard)/invoices/[id]/page.tsx',".eq('business_id',businessId)"],['app/(dashboard)/payments/[id]/page.tsx',".eq('business_id',businessId)"],['components/print-document-button.tsx','window.print']];
for(const [file,phrase] of entries){const code=fs.readFileSync(path.join(root,file),'utf8');if(!code.includes(phrase))throw Error(file+' missing '+phrase)}
console.log('Phase 023 source guard checks passed. Live database/RLS integration still required.');
