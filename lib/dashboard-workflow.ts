/** Presentation policy only; authorization remains server-side. */
export type DashboardRole='owner'|'manager'|'finance'|'sales'|'inventory'|'staff'|string;
export type DashboardLink={label:string;href:string;kind:'sales'|'customer'|'payments'|'stock'|'finance'|'support'|'setup'|'team';icon:'order'|'customer'|'payments'|'product'|'pos'|'expenses'|'inventory'|'reports'|'team'|'support'|'setup'};
const salesRoles=['owner','manager','finance','sales'];
const financeRoles=['owner','manager','finance'];
const inventoryRoles=['owner','manager','inventory'];
export function dashboardAccess(role:DashboardRole,enabledFeatures:readonly string[]){
 const enabled=new Set(enabledFeatures);
 return {sales:salesRoles.includes(role),finance:financeRoles.includes(role),products:inventoryRoles.includes(role),
 pos:enabled.has('pos')&&['owner','manager','sales'].includes(role),
 inventory:enabled.has('inventory')&&inventoryRoles.includes(role),
 purchasing:enabled.has('purchasing')&&inventoryRoles.includes(role),
 reports:enabled.has('financial_reports')&&financeRoles.includes(role),
 team:role==='owner'||role==='manager'};
}
export function dashboardQuickActions(role:DashboardRole,enabledFeatures:readonly string[]):DashboardLink[]{
 const a=dashboardAccess(role,enabledFeatures);const out:DashboardLink[]=[];
 const add=(yes:boolean,x:DashboardLink)=>{if(yes)out.push(x)};
 add(a.sales,{label:'New order',href:'/orders/new',kind:'sales',icon:'order'});
 add(a.sales,{label:'Add customer',href:'/customers/new',kind:'customer',icon:'customer'});
 add(a.products,{label:'Add product',href:'/products/new',kind:'stock',icon:'product'});
 add(a.sales,{label:'Payments',href:'/payments',kind:'payments',icon:'payments'});
 add(a.pos,{label:'Retail POS',href:'/pos',kind:'sales',icon:'pos'});
 add(a.finance,{label:'Expenses',href:'/expenses',kind:'finance',icon:'expenses'});
 add(a.inventory,{label:'Inventory',href:'/inventory',kind:'stock',icon:'inventory'});
 add(a.purchasing,{label:'Purchasing',href:'/purchasing',kind:'stock',icon:'product'});
 add(a.reports,{label:'Reports',href:'/reports',kind:'finance',icon:'reports'});
 add(a.team,{label:'Team',href:'/team',kind:'team',icon:'team'});
 add(true,{label:'Getting started',href:'/getting-started',kind:'setup',icon:'setup'});
 add(true,{label:'Help',href:'/support',kind:'support',icon:'support'});
 return out.slice(0,6);
}
export function dashboardReportLinks(role:DashboardRole,features:readonly string[]):DashboardLink[]{
 if(!dashboardAccess(role,features).reports)return [];
 return [{label:'Retail performance',href:'/retail-reports',kind:'finance',icon:'reports'},
 {label:'Accounting reports',href:'/reports',kind:'finance',icon:'reports'}];
}
export function dashboardAttentionLinks(role:DashboardRole,features:readonly string[],outstandingOrders:number,lowStock:number):DashboardLink[]{
 const a=dashboardAccess(role,features);const out:DashboardLink[]=[];
 if(a.sales&&Number.isFinite(outstandingOrders)&&outstandingOrders>0)
  out.push({label:`${outstandingOrders} orders await payment`,href:'/orders',kind:'payments',icon:'order'});
 if(a.inventory&&Number.isFinite(lowStock)&&lowStock>0)
  out.push({label:`${lowStock} low-stock products`,href:'/inventory',kind:'stock',icon:'inventory'});
 out.push({label:'Get platform support',href:'/support',kind:'support',icon:'support'});
 return out;
}
