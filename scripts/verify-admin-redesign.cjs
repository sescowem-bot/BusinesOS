// Static regression checks for the platform owner dashboard redesign.
// These do not replace TypeScript typechecking, browser or Supabase tests.
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(condition,reason)=>{if(!condition)throw Error(reason)};
const layout=read('app/admin/layout.tsx');
const shell=read('components/admin-workspace.tsx');
const overview=read('app/admin/page.tsx');
const css=read('app/admin/owner-console.css');
check(layout.includes('requirePlatformAdmin')&&layout.includes("redirect('/login')"),'Admin shell must gate user access server-side');
check(shell.includes("usePathname")&&shell.includes('aria-current')&&shell.includes('aria-label="System Owner sidebar"'),'Admin navigation missing active state or semantics');
for(const url of ['/admin/website','/admin/content','/admin/plans','/admin/email','/admin/businesses','/admin/upgrades','/admin/plan-access','/admin/my-business','/admin/notifications','/admin/health'])check(shell.includes(url),'Missing navigation URL '+url);
check(shell.includes('signOut')&&shell.includes('menuOpen')&&shell.includes('owner-menu-toggle'),'Logout or mobile navigation unavailable');
check(overview.includes("rpc('platform_business_directory')")&&overview.includes("from('business_upgrade_requests')")&&overview.includes("from('public_site_pages')"),'Overview must use real database information');
check(css.includes('@media(max-width:800px)')&&css.includes('prefers-reduced-motion')&&css.includes(':focus-visible'),'Responsive and accessible navigation styles missing');
check(!overview.includes('Fake Revenue')&&!overview.includes('Demo metrics'),'Demo metrics are prohibited');
check(fs.existsSync(path.join(root,'README.md')),'README.md must remain at repository root');
const leftovers=fs.readdirSync(root).filter(f=>f.endsWith('.md')&&f!=='README.md');
check(!leftovers.length,`Root Markdown files must be in MD/: ${leftovers.join(', ')}`);
console.log('Platform admin redesign source checks passed. Browser, Supabase and full Next.js build checks remain necessary.');
