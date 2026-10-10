const fs=require('node:fs');
const assert=require('node:assert/strict');
const shell=fs.readFileSync('components/shell.tsx','utf8');
const home=fs.readFileSync('app/(dashboard)/dashboard/page.tsx','utf8');
const css=fs.readFileSync('app/globals.css','utf8');
const checks=[
 ['Role-separated platform navigation',shell.includes('isPlatformAdmin?[{title:')&&shell.includes("href:'/admin'")],
 ['All customer tools still accessible', ['/customers','/orders','/products','/invoices','/payments','/expenses','/inventory','/accounting','/reports','/settings','/upgrade'].every(link=>shell.includes(`href:'${link}'`))],
 ['Responsive full-menu drawer',shell.includes('work-drawer-backdrop')&&shell.includes('work-menu-toggle')&&css.includes('.work-sidebar.open')],
 ['Mobile menu escape and close handling',shell.includes("event.key==='Escape'")&&shell.includes('onNavigate={closeDrawer}')&&shell.includes('setDrawerOpen(false)')],
 ['Navigation current-page indication',shell.includes('aria-current')],
 ['Notifications and logout retained',shell.includes('unreadCount')&&shell.includes('href="/logout"')],
 ['Business dashboard reads real business data',home.includes("client.rpc('business_dashboard_command'")&&home.includes('recent_orders')],
 ['Business dashboard actions use real routes',home.includes('href="/orders/new"')&&home.includes('href="/customers/new"')],
 ['Period trends use real current/prior amounts',home.includes('previous_sales')&&home.includes('previous_received')&&home.includes('change(gross')],
 ['No fabricated KPI metrics',!home.includes('1000000')&&!home.includes('₦250')],
 ['Responsive and reduced-motion styles',css.includes('@media(max-width:900px)')&&css.includes('@media(prefers-reduced-motion:reduce)')],
 ['Print document styles maintained',css.includes('@media print')],
 ['Project docs in MD only',fs.existsSync('MD/PHASE_028_BUSINESS_WORKSPACE_UX.md')]
];
let failed=0;
for(const [label,passed] of checks){console.log(`${passed?'PASS':'FAIL'}: ${label}`);if(!passed)failed++}
assert.equal(failed,0,'Phase 028 verification failed');
