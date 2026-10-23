'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const configured=require('./regression-checks.json');
function ciRuns(task){
 const yaml=read('.github/workflows/verify.yml');
 if(task==='typecheck'||task==='build')return yaml.includes('npm run '+task);
 const scripts=JSON.parse(read('package.json')).scripts;
 return yaml.includes('npm run verify:regressions')
   && scripts['verify:regressions']==='node scripts/run-regression-checks.cjs'
   && typeof scripts[task]==='string'
   && configured.includes(task);
}
module.exports={ciRuns};
