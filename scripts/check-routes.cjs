#!/usr/bin/env node
// Fail CI before Next.js if multiple pages collapse to the same URL.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(process.cwd(), 'app');
const pages = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,e.name);
    if(e.isDirectory()) walk(p);
    else if (/^page\.(tsx|jsx|ts|js)$/.test(e.name)) pages.push(p);
  }
}
if (fs.existsSync(root)) walk(root);
function route(file){
 const parts=path.relative(root,path.dirname(file)).split(path.sep)
   .filter(s=>s && !/^\(.*\)$/.test(s) && !s.startsWith('@'));
 return '/' + parts.join('/');
}
const map = new Map();
for (const file of pages) {
 const p=route(file);
 map.set(p,[...(map.get(p)||[]),path.relative(process.cwd(),file)]);
}
let failures=0;
for(const [route,files] of map) if(files.length>1){
 failures++;
 console.error(`DUPLICATE ROUTE ${route}:\n  ${files.join('\n  ')}`);
}
if(failures) process.exit(1);
console.log(`Route audit passed: ${pages.length} pages, no duplicate URLs.`);
