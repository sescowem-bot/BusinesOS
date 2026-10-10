/** Public product capabilities. Never describe unreleased integrations as active. */
export const essentialCapabilities=[
 {key:'dashboard',name:'Business dashboard',detail:'View your workspace and available operational summaries'},
 {key:'customers',name:'Customer records',detail:'Keep customer profiles and order histories together'},
 {key:'orders',name:'Orders and sales records',detail:'Record orders and monitor their progress'},
 {key:'payments',name:'Payment and balance tracking',detail:'Record payments, including partial payments and outstanding balances'},
 {key:'products',name:'Product and service catalogue',detail:'Organise the items and services you sell'},
 {key:'expenses',name:'Expense records',detail:'Record business expenses and their details'},
 {key:'documents',name:'Commercial documents',detail:'Use available printable statements, acknowledgements and issued commercial invoices'},
 {key:'settings',name:'Business settings',detail:'Maintain the contact and identity details of your business'}
] as const;
export const paidCapabilities=[
 {key:'inventory',name:'Stock and inventory',group:'Operations',detail:'Review quantities, low-stock records and stock movements'},
 {key:'team',name:'Team and branches',group:'Operations',detail:'Member invitations, branch records and internal approval requests'},
 {key:'accounting',name:'Accounting workspace',group:'Finance',detail:'Manual ledgers and journal records; transaction auto-posting is under development'},
 {key:'financial_reports',name:'Financial reports',group:'Finance',detail:'Available financial summaries and exports; formal reporting requires review'},
 {key:'tax',name:'Tax records and reminders',group:'Finance',detail:'Tax-related recordkeeping and estimates; not automatic tax filing'},
 {key:'communications',name:'Customer conversations',group:'Communications',detail:'Internal conversation notes and draft messages; external sending is not yet live'},
 {key:'campaigns',name:'Campaign planning',group:'Communications',detail:'Create campaign records and drafts; external dispatch is not yet live'},
 {key:'insights',name:'Business insights',group:'Growth',detail:'Available business trends and summaries based on recorded data'},
 {key:'growth',name:'Growth resources',group:'Growth',detail:'Business resources, templates and growth planning tools'}
] as const;
export type PaidFeature=typeof paidCapabilities[number]['key'];
export const planRoles=[
 {key:'owner',name:'Owner',detail:'Business account owner'},
 {key:'manager',name:'Manager',detail:'Business operations supervisor'},
 {key:'finance',name:'Finance',detail:'Financial records and reporting'},
 {key:'sales',name:'Sales',detail:'Customer and sales support'},
 {key:'inventory',name:'Inventory',detail:'Stock operations'},
 {key:'staff',name:'Staff',detail:'General member'}
] as const;
export type PlanRole=typeof planRoles[number]['key'];
export const defaultFeatureRoleAccess:Record<PaidFeature,readonly PlanRole[]>={
 inventory:['owner','manager','inventory'],team:['owner'],accounting:['owner','manager','finance'],financial_reports:['owner','manager','finance'],tax:['owner','manager','finance'],communications:['owner','manager','sales'],campaigns:['owner','manager'],insights:['owner','manager','finance'],growth:['owner','manager']
};
export const capabilityKeys=paidCapabilities.map(x=>x.key);
export function isPaidFeature(value:string):value is PaidFeature{return paidCapabilities.some(f=>f.key===value)}
export function isPlanRole(value:string):value is PlanRole{return planRoles.some(r=>r.key===value)}
