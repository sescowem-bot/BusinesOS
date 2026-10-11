#!/usr/bin/env node
// Read-only source safeguard. Verifies ordinary customers aren't shown infrastructure instructions.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const ts=require('./load-typescript.cjs')
const read=p=>fs.readFileSync(p,'utf8');let checks=0;
function expect(value,label){assert.ok(value,label);checks++}
const guide=read('components/install-app-guide.tsx');
for(const needle of ['detectDevice()',"/CriOS/i.test(navigator.userAgent)","useState<IosBrowser>",'iosBrowser===\'chrome\'','iosBrowser===\'safari\'','Add to Home Screen','WhatsApp','in-app browser','beforeinstallprompt','appinstalled','aria-pressed','Open as Web App'])expect(guide.includes(needle),'iOS/Chrome install guide: '+needle);
expect(!guide.includes("If you're in Chrome, WhatsApp, or another browser, copy the website link and open it in Safari."),'Chrome iOS must not be forced to switch to Safari');
for(const needle of ['manifest:',"appleWebApp:{capable:true"] )expect(read('app/layout.tsx').includes(needle),'missing iOS app metadata '+needle);
expect(read('app/manifest.ts').includes("display:'standalone'"),'missing web-app standalone mode');
expect(read('app/globals.css').includes('.install-browser-option:focus-visible'),'browser choice needs keyboard focus styling');
const safe=read('lib/user-feedback.ts');expect(safe.includes('friendlyServiceError'),'missing shared error mapping');
expect(!safe.includes('return error.message'),'raw provider error mapping');
const files=[];
function scan(dir){for(const x of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,x.name);if(x.isDirectory())scan(f);else if(x.name.endsWith('.tsx'))files.push(f)}}
scan('app/(dashboard)');scan('app/(auth)');scan('app/(public)');scan('app/install');scan('components');
const banned=/\b(?:SQL\s*migrations?|Supabase|PostgREST|RLS|RPC|PGRST\d+|database|backend|stack trace|optimistic concurrency)\b/i;
for(const f of files){
 const src=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 expect(src.parseDiagnostics.length===0,`invalid customer page TSX: ${f}`);
 // Only rendered copy: comments, imports, and admin-only developer diagnostics are excluded.
 if(f.startsWith('components/admin-'))continue;
 function traverse(node){
  if(ts.isJsxText(node)&&banned.test(node.getText(src).trim()))throw new Error(`Developer-facing copy in ${f}: ${node.getText(src).trim().slice(0,140)}`);
  if(ts.isJsxAttribute(node)&&node.initializer&&ts.isStringLiteral(node.initializer)&&['description','placeholder','title','aria-label'].includes(node.name.text)&&banned.test(node.initializer.text))throw new Error(`Developer-facing attribute copy in ${f}: ${node.initializer.text.slice(0,140)}`);
  ts.forEachChild(node,traverse);
 }traverse(src);
}
for(const f of ['app/error.tsx','app/global-error.tsx','app/(dashboard)/error.tsx','app/admin/error.tsx']){
 const code=read(f);
 expect(!/console\.error\([^\n]*\berror\b/.test(code),'raw error logged to client console in '+f);
 expect(!/error\.digest|error\.message/.test(code),'internal error identifier displayed in '+f);
 expect(code.includes('Try again'),'retry action required for '+f);
}
expect(!read('app/(dashboard)/dashboard/page.tsx').includes('Apply SQL migration'),'old dashboard error in customer view');
expect(!read('app/(dashboard)/quotes/page.tsx').includes('Check database permissions'),'quote page exposes technical advice');
console.log(`Customer UI language, iOS Chrome/Safari install and safe-error review passed: ${checks} assertions across ${files.length} customer TSX files.`);
