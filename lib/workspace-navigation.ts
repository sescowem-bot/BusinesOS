/** Presentation only; database RLS and server authorization remain mandatory. */
export type WorkspaceNavMode='simple'|'advanced';
export type WorkspaceNavigationItem={href:string};
export type WorkspaceNavigationGroup<T extends WorkspaceNavigationItem>={title:string;items:T[]};
export function primaryWorkspacePaths(role?:string):readonly string[]{
 switch(role){
 case 'sales':return ['/dashboard','/getting-started','/customers','/orders','/products','/payments','/pos','/settings'];
 case 'finance':return ['/dashboard','/getting-started','/orders','/customers','/payments','/expenses','/reports','/settings'];
 case 'inventory':return ['/dashboard','/getting-started','/products','/inventory','/purchasing','/tasks','/support','/settings'];
 case 'staff':return ['/dashboard','/getting-started','/customers','/orders','/products','/expenses','/support','/settings'];
 default:return ['/dashboard','/getting-started','/customers','/orders','/products','/payments','/expenses','/settings'];
 }}
export function isWorkspacePath(pathname:string,href:string):boolean{
 return pathname===href||(href!=='/dashboard'&&href!=='/admin'&&pathname.startsWith(href+'/'));
}
export function workspaceNavigationGroups<T extends WorkspaceNavigationItem>(
 accessible:readonly WorkspaceNavigationGroup<T>[],
 options:{mode:WorkspaceNavMode;search:string;pathname:string;role?:string}
):WorkspaceNavigationGroup<T>[]{
 if(options.mode==='advanced'||options.search.trim())return accessible.map(g=>({...g,items:[...g.items]}));
 const allowed=new Map(accessible.flatMap(group=>group.items.map(item=>[item.href,item] as const)));
 const everyday=primaryWorkspacePaths(options.role).flatMap(href=>{const item=allowed.get(href);return item?[item]:[]});
 const active=Array.from(allowed.values()).filter(x=>isWorkspacePath(options.pathname,x.href)).sort((a,b)=>b.href.length-a.href.length)[0];
 const current=active&&!everyday.some(item=>item.href===active.href)?[active]:[];
 return [...(everyday.length?[{title:'Everyday',items:everyday}]:[]),...(current.length?[{title:'Current tool',items:current}]:[])];
}
export type SetupAction={title:string;href:string;action:string;complete:boolean|null;canPerform:boolean};
export function nextWorkspaceSetupAction<T extends SetupAction>(steps:readonly T[]):T|undefined{return steps.find(s=>s.complete===false&&s.canPerform)}
const workspaceRoleLimits:Record<string,readonly string[]>={
 '/pos':['owner','manager','sales'],'/pos/shifts':['owner','manager','sales'],'/returns':['owner','manager','sales'],
 '/wholesale':['owner','manager','sales'],'/inventory':['owner','manager','inventory'],'/inventory/locations':['owner','manager','inventory'],
 '/purchasing':['owner','manager','inventory'],'/accounting':['owner','manager','finance'],
 '/reports':['owner','manager','finance'],'/retail-reports':['owner','manager','finance'],
};
export function workspaceRoleCanSeeLink(role:string|undefined,href:string):boolean{
 const required=workspaceRoleLimits[href];return !required||required.includes(role||'');
}
export function mobileWorkspacePaths(role:string|undefined,isPlatformAdmin:boolean):string[]{
 const links=['/dashboard'];const canSell=['owner','manager','finance','sales'].includes(role||'');
 if(canSell)links.push('/orders','/customers');
 if(isPlatformAdmin)links.push('/admin');else if(canSell)links.push('/payments');
 return links;
}
