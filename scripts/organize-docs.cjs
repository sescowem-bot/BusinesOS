/* Keep README.md at GitHub root; move legacy project documentation to MD/.
   Safe to run repeatedly. Files with colliding names are never overwritten. */
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const dest=path.join(root,'MD');fs.mkdirSync(dest,{recursive:true});
let moved=0;
for(const p of fs.readdirSync(root)){
 if(p==='README.md'||!p.toLowerCase().endsWith('.md'))continue;
 const src=path.join(root,p);if(!fs.statSync(src).isFile())continue;
 const target=path.join(dest,p);
 if(fs.existsSync(target)){
  if(fs.readFileSync(src).equals(fs.readFileSync(target))){fs.unlinkSync(src);continue;}
  throw Error('Documentation name collision: '+p);
 }
 fs.renameSync(src,target);moved++;
}
const oldDocs=path.join(root,'docs');
if(fs.existsSync(oldDocs)){
 for(const entry of fs.readdirSync(oldDocs)){
  const src=path.join(oldDocs,entry);if(!fs.statSync(src).isFile())continue;
  if(!/\.(md|sql)$/i.test(entry))continue;
  const target=path.join(dest,entry);
  if(fs.existsSync(target)){
   if(fs.readFileSync(src).equals(fs.readFileSync(target))){fs.unlinkSync(src);continue;}
   throw Error('Documentation name collision: '+entry);
  }
  fs.renameSync(src,target);moved++;
 }
 if(fs.readdirSync(oldDocs).length===0)fs.rmdirSync(oldDocs);
}
console.log(`Documentation organised. ${moved} file(s) moved. GitHub README.md remains at root.`);
