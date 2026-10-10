#!/usr/bin/env node
/** Source parsing and pure-logic regression checks; NOT a TypeScript typecheck or E2E test. */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'businessos-phase21-'));
let files=0;
try{
 function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
   if(['node_modules','.next','.git'].includes(ent.name))continue;
   const full=path.join(dir,ent.name);
   if(ent.isDirectory())walk(full);
   else if(/\.tsx?$/.test(full)&&!full.endsWith('.d.ts')){
    files++;
    const relative=path.relative(root,full);
    const result=ts.transpileModule(fs.readFileSync(full,'utf8'),{
     fileName:full,reportDiagnostics:true,
     compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}
    });
    const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    if(errors.length)throw new Error(`${relative}: ${errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(' | ')}`);
    if(/^(lib\/(?:calculations|reporting\/financial|tax\/engine)\.ts|tests\/.*\.test\.ts)$/.test(relative)){
     const dest=path.join(scratch,relative.replace(/\.tsx?$/,'.js'));
     fs.mkdirSync(path.dirname(dest),{recursive:true});
     fs.writeFileSync(dest,result.outputText);
    }
   }
  }
 }
 walk(root);
 console.log(`Source parsing passed: ${files} TypeScript/TSX files`);
 for(const group of ['calculations','reporting','tax-engine']){
  const result=cp.spawnSync(process.execPath,[path.join(scratch,'tests',`${group}.test.js`)],{encoding:'utf8'});
  if(result.status!==0)throw new Error(`${group} tests failed: ${result.stderr||result.stdout}`);
  console.log(result.stdout.trim());
 }
 console.log('Phase 021 checks passed. Run npm run typecheck && npm run build separately.');
}catch(error){console.error(error.message);process.exitCode=1}
finally{fs.rmSync(scratch,{recursive:true,force:true})}
