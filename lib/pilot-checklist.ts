/** Phase 030: Pilot acceptance catalogue. A recorded PASS is an administrator assertion,
 * not an automated security certificate or permission to launch. */
export type PilotStatus='pass'|'fail'|'blocked'|'not_tested';
export type PilotEnvironment='preview'|'production';
export type PilotCheck={id:string;name:string;expected:string;critical:boolean};
export type PilotGroup={name:string;checks:readonly PilotCheck[]};
export const pilotGroups:readonly PilotGroup[]=[
 {name:'Authentication and account security',checks:[
  {id:'AUTH-01',name:'Complete account lifecycle',expected:'Signup, confirmation, login, logout and reset-password work with verified accounts.',critical:true},
  {id:'AUTH-02',name:'Disabled Super Admin',expected:'A disabled System Owner loses privileged access on the next server request.',critical:true},
  {id:'AUTH-03',name:'Switch workspace',expected:'Switching between two owned businesses changes all scoped records correctly.',critical:true}]},
 {name:'Security and tenant isolation',checks:[
  {id:'SEC-01',name:'Admin routes denied to staff',expected:'Normal business users cannot open or read administration routes or data.',critical:true},
  {id:'SEC-02',name:'Cross-business isolation',expected:'Another business ID, URL or cookie cannot read or change customer records.',critical:true},
  {id:'SEC-03',name:'Plan and role enforcement',expected:'Direct database/RPC requests cannot bypass role or approved-plan checks.',critical:true},
  {id:'SEC-04',name:'Anonymous diagnostic access',expected:'Unauthenticated setup-status requests return access denied without secrets.',critical:true},
  {id:'SEC-05',name:'Report scope',expected:'Reports and exports include only authorised business records.',critical:true}]},
 {name:'Business operations',checks:[
  {id:'BIZ-01',name:'Customer to order',expected:'Customer, product and order records persist with correct totals.',critical:true},
  {id:'BIZ-02',name:'Partial and final payment',expected:'Remaining balance decreases accurately without duplicate payments.',critical:true},
  {id:'BIZ-03',name:'Duplicate invoice protection',expected:'Two concurrent invoice requests result in one issued invoice.',critical:true},
  {id:'INV-01',name:'Concurrent stock count',expected:'Inventory count conflicts do not silently overwrite later movements.',critical:true}]},
 {name:'Finance and reporting',checks:[
  {id:'GL-01',name:'Expense and balanced journal',expected:'Paid expense produces a correct journal when accounting is enabled.',critical:true},
  {id:'GL-02',name:'Unposted source reconciliation',expected:'Pending or failed postings are shown; reports do not silently claim completeness.',critical:true},
  {id:'RPT-01',name:'Accurate financial export',expected:'Exported data matches authorised database records; CSV responses are private.',critical:true},
  {id:'RPT-02',name:'Oversized dataset protection',expected:'Incomplete data exports fail clearly rather than downloading partial CSV.',critical:true}]},
 {name:'Platform management and communication',checks:[
  {id:'ADM-01',name:'Upgrade approval and permissions',expected:'Approvals update the right business plan, with a working audit and feature access.',critical:true},
  {id:'CMS-01',name:'Live brand and legal pages',expected:'Approved branding, favicon and legal pages work on desktop and mobile.',critical:true},
  {id:'MAIL-01',name:'Resend test delivery',expected:'Email is received, accurately branded and reflected in provider delivery logs.',critical:false},
  {id:'MAIL-02',name:'Forged webhook',expected:'Unsigned or forged Resend callbacks are rejected without changing records.',critical:true},
  {id:'MAIL-03',name:'Auth email staging and rollback',expected:'All Auth email types work in staging and original delivery can be restored.',critical:true}]},
 {name:'Deployment and user experience',checks:[
  {id:'UX-01',name:'Responsive and accessible interface',expected:'Admin, website and business pages work on desktop, mobile and keyboard.',critical:false},
  {id:'BUILD-01',name:'Build and independent CI checks',expected:'Next.js typecheck/build and Deno check pass at the exact candidate commit.',critical:true}]}
] as const;
export const allPilotChecks=pilotGroups.flatMap(g=>g.checks);
export const pilotCheckIds=new Set(allPilotChecks.map(c=>c.id));
