#!/usr/bin/env node
/** Local source-level checks. This does not replace tsc, a Next.js build or live RPC tests. */
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
let count=0;
let failures=[];
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(['node_modules','.next','.git'].includes(entry.name))continue;
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())walk(full);
  else if(/\.tsx?$/.test(entry.name)&&!entry.name.endsWith('.d.ts')){
   count++;
   const source=fs.readFileSync(full,'utf8');
   const parsed=ts.createSourceFile(full,source,ts.ScriptTarget.Latest,true,full.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
   if(parsed.parseDiagnostics.length)failures.push(`${path.relative(root,full)}: ${parsed.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join('; ')}`);
  }
 }
}
walk(root);
const migration=fs.readFileSync(path.join(root,'supabase/migrations/021_admin_business_review.sql'),'utf8');
for(const requirement of [
 'ENABLE ROW LEVEL SECURITY','REVOKE ALL ON public.platform_business_review_notes',
 'platform_business_detail(p_business_id uuid)',
 'platform_save_business_review(p_business_id uuid,p_status text,p_note text)',
 "auth.uid()",'USING ERRCODE=\'42501\''
])if(!migration.includes(requirement))failures.push(`Migration 021 missing: ${requirement}`);
const detail=fs.readFileSync(path.join(root,'app/admin/businesses/[id]/page.tsx'),'utf8');
if(!detail.includes('requirePlatformAdmin'))failures.push('Business detail must require admin');
const form=fs.readFileSync(path.join(root,'app/admin/cms-form.tsx'),'utf8');
if(!form.includes('JSON.stringify(sections)')||!form.includes('Add section'))failures.push('CMS section editor missing');
console.log(`Parsed ${count} TypeScript/TSX files`);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Phase 022 source and migration safety checks passed.');
