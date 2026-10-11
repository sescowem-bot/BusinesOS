/** Informational feature directory. Licensable entitlements are the 11 module keys, NOT every workflow below. */
export const moduleWorkflows:Record<string,readonly string[]>={
 pos:['Barcode and product search','Retail checkout','Hold and resume carts','Split payment recording','Branded POS receipts','Cashier shifts and closings','Returns and credit notes','Branch-aware checkout','Reviewed VAT pricing'],
 purchasing:['Supplier directory','Purchase orders','Part-delivery receipts','Supplier invoices','Partial supplier payments','Outstanding supplier bills'],
 inventory:['Low-stock alerts','Physical stock counts','Stock movement history','Branch stock balances','Stock transfers','Receiving location','Stock variance history'],
 team:['Invite team members','Branch records','Approval requests','Change built-in staff roles','Role change audit'],
 accounting:['Chart of accounts','Manual general ledger journals','Trial balance review','Transaction posting controls'],
 financial_reports:['Retail management reporting','Product movement analysis','Estimated product margin','Branch comparisons','Reporting-period filters'],
 tax:['Tax records','VAT treatment review','Invoice tax evidence','Tax reminders'],
 communications:['Customer conversation notes','Draft follow-up messages','Communication history'],
 campaigns:['Campaign drafts','Audience planning','Campaign review requests'],
 insights:['Sales trends','Operational summaries','Customer activity overview'],
 growth:['Business resources','Growth centre','Sales follow-up planning']
};
export const moduleWorkflowCount=Object.values(moduleWorkflows).reduce((sum,x)=>sum+x.length,0);
export const builtInRoleGuides=[
 {name:'Owner',base:'owner',detail:'Business owner, can administer their company and entitled modules; ownership cannot be assigned from custom roles.'},
 {name:'Manager',base:'manager',detail:'Supervises operations, reviews approved workflows and can use modules granted to managers.'},
 {name:'Finance',base:'finance',detail:'Manages eligible financial records, reports and tax information.'},
 {name:'Sales',base:'sales',detail:'Handles customers, orders, payment recording and entitled retail checkout.'},
 {name:'Inventory',base:'inventory',detail:'Handles eligible stock counts, receiving and procurement workflows.'},
 {name:'Staff',base:'staff',detail:'Basic workspace access only, unless the approved business plan allows more.'}
] as const;
