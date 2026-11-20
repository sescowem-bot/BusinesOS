#!/usr/bin/env node
const fs=require('node:fs'),assert=require('node:assert/strict');const read=p=>fs.readFileSync(p,'utf8');
const proxy=read('proxy.ts'),root=read('app/layout.tsx'),brand=read('lib/server/branding.ts');
const cms=read('lib/server/public-cms.ts'),workspace=read('lib/server/workspace.ts');
const home=read('app/page.tsx'),publicPage=read('app/(public)/[slug]/page.tsx'),pricing=read('app/pricing/page.tsx');
let checked=0;const check=(v,m)=>{assert.ok(v,m);checked++};
check(proxy.includes('const protectedPath=/^\\/('),'protected page refresh matcher missing');
for(const p of ['admin','onboarding','orders','pos','inventory','dashboard'])check(proxy.includes(p),'protected matcher '+p);
check(proxy.includes("const isRouteHandler=isApi||pathname==='/auth/callback'"),'all Route Handlers must be covered');
check(proxy.includes("request.method==='POST'&&request.headers.has('next-action')"),'all Server Action POSTs must be covered');
check(proxy.includes('if(!isRouteHandler&&!isServerAction&&!shouldRefresh)return NextResponse.next({request})'),'public pages must skip auth refresh');
check(!root.includes("dynamic='force-dynamic'"),'root forces dynamic rendering');
check(root.includes('revalidate=60'), 'root cache window absent');
for(const [name,page] of [['home',home],['slug',publicPage],['pricing',pricing]]){
 check(page.includes("dynamic='force-dynamic'"),name+' must render account-aware navigation on each request');
 check(page.includes('getViewerAccess()'),name+' must show the correct signed-in workspace navigation');
}
check(brand.includes('unstable_cache')&&brand.includes("tags:['businessos-public-brand']"),'brand cache missing');
check(cms.includes('unstable_cache')&&cms.includes("tags:['businessos-public-pages']"),'public CMS cache missing');
check(cms.includes("tags:['businessos-public-plans']"),'plans cache missing');
check(workspace.includes("import {cache} from 'react'")&&workspace.includes('getWorkspace=cache('),'request-level identity dedup absent');
check(!workspace.includes('unstable_cache'),'private identity must never be cached across requests');
check(read('app/admin/actions.ts').includes("updateTag('businessos-public-brand')"),'admin brand cache invalidation absent');
check(read('app/admin/cms-actions.ts').includes("updateTag('businessos-public-pages')"),'CMS cache invalidation absent');
check(read('app/admin/cms-actions.ts').includes("updateTag('businessos-public-plans')"),'public plans cache invalidation absent');
check(read('app/(dashboard)/dashboard/page.tsx').includes('business_dashboard_command')&&read('app/(dashboard)/dashboard/loading.tsx').includes('WorkspaceLoadingBrand')&&read('components/workspace-loading-brand.tsx').includes('aria-busy'),'bounded dashboard RPC + accessible shared loading route absent');
check(read('components/public-nav.tsx').includes('prefetch={false}'),'public nav prefetch must be bounded');
console.log(`BusinessOS performance integrity passed (${checked} checks); live timings require Vercel Preview and Web Vitals.`);
