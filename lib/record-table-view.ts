/** Client pagination only; the server still owns access controls and row limits. */
export type SearchableRecord={search:string;filter?:string};
export type RecordPage<T>={matches:T[];shown:T[];page:number;pages:number;total:number};
export function getRecordPage<T extends SearchableRecord>(rows:readonly T[],search:string,status:string,requestedPage:number,pageSize=20):RecordPage<T>{
 const query=search.trim().toLocaleLowerCase();
 const matches=rows.filter(row=>(status==='all'||row.filter===status)&&(!query||row.search.toLocaleLowerCase().includes(query)));
 const safeSize=Number.isSafeInteger(pageSize)&&pageSize>0?Math.min(pageSize,100):20;
 const pages=Math.max(1,Math.ceil(matches.length/safeSize));
 const page=Number.isSafeInteger(requestedPage)?Math.min(pages,Math.max(1,requestedPage)):1;
 const shown=matches.slice((page-1)*safeSize,page*safeSize);
 return {matches,shown,page,pages,total:matches.length};
}
