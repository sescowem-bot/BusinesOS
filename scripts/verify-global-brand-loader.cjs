#!/usr/bin/env node
const fs=require('node:fs');const assert=require('node:assert/strict');const read=p=>fs.readFileSync(p,'utf8');let n=0;function check(ok,msg){assert.ok(ok,msg);n++;}
const loader=read('components/workspace-loading-brand.tsx');const shell=read('components/shell.tsx');const css=read('app/globals.css');
const layout=read('app/(dashboard)/layout.tsx');const proxy=read('proxy.ts');
for(const file of ['app/loading.tsx','app/admin/loading.tsx','app/(dashboard)/loading.tsx','app/(dashboard)/dashboard/loading.tsx','app/(dashboard)/expenses/loading.tsx'])check(read(file).includes('WorkspaceLoadingBrand'),`${file} missing branded loader`);
check(loader.includes('createContext')&&loader.includes('useContext'),'brand context missing');
check(shell.includes('WorkspaceLoadingBrandProvider'),'brand provider not wired to workspace');
check(shell.includes('brand?.logo_url'),'must reuse existing platform branding, not fetch at loading time');
check(loader.includes('/app-icon-192.png'),'local icon fallback missing');
check(!loader.includes('supabase')&&!loader.includes('fetch('),'loading spinner must not query a database or network');
check(loader.includes('setTimeout')&&loader.includes('Retry page')&&loader.includes('Get support'),'slow server state recovery missing');
check(loader.includes('aria-live')&&loader.includes('aria-busy'),'loader must be accessible');
check(css.includes('bo-premium-spin')&&css.includes('prefers-reduced-motion:reduce'),'reduced-motion animation guard missing');
check(css.includes('--loader-size')&&css.includes('bo-premium-loader--section'),'mobile and nested layout missing');
check(shell.includes('prefetch={false} onClick={onNavigate}'),'sidebar should not prefetch every module');
check((shell.match(/prefetch=\{false\}/g)||[]).length>=7,'many workspace nav links still trigger route prefetch');
check(layout.includes('Promise.all'),'layout queries should run concurrently');
check(read('lib/server/workspace.ts').includes('getWorkspace=cache('),'private workspace lookup should reuse React request cache');
check(!loader.includes('unstable_cache'),'private loader must not cache workspace data');
check(read('lib/server/workspace.ts').includes('BUSINESSOS_PERF_DIAGNOSTICS'),'opt-in server latency logging absent');
check(!proxy.includes("matcher:['/:path*'"),'public route proxy refresh should remain excluded');
check(read('app/(dashboard)/expenses/page.tsx').includes('<Suspense'),'expense streaming must remain present');
console.log(`Global branded loader and navigation speed checks passed (${n} assertions). No SQL changes or data caching.`);
