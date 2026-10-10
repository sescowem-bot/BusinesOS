'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';

export type RecordCell={text:string;href?:string;kind?:'strong'|'muted'|'amount'|'status';tone?:'success'|'warning'|'danger'|'neutral'};
export type RecordItem={id:string;cells:RecordCell[];search:string;filter?:string};
type Props={columns:string[];rows:RecordItem[];searchLabel?:string;emptyTitle:string;emptyDescription:string;emptyHref?:string;emptyAction?:string;limitNote?:string};
const size=20;
export function BusinessRecordsTable({columns,rows,searchLabel='Search records',emptyTitle,emptyDescription,emptyHref,emptyAction,limitNote}:Props){
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState('all');
 const [page,setPage]=useState(1);
 const filters=useMemo(()=>Array.from(new Set(rows.map(r=>r.filter).filter((v):v is string=>Boolean(v)))).sort(),[rows]);
 const matches=useMemo(()=>rows.filter(row=>(status==='all'||row.filter===status)&&(!search.trim()||row.search.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))),[rows,search,status]);
 const pages=Math.max(1,Math.ceil(matches.length/size));
 const current=Math.min(page,pages);
 const shown=matches.slice((current-1)*size,current*size);
 const updateSearch=(value:string)=>{setSearch(value);setPage(1)};
 const updateStatus=(value:string)=>{setStatus(value);setPage(1)};
 return <div className="bo-records">
  <div className="bo-table-tools">
   <label className="bo-table-search"><span className="bo-visually-hidden">{searchLabel}</span>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
    <input type="search" value={search} onChange={e=>updateSearch(e.target.value)} placeholder={searchLabel}/>
   </label>
   {filters.length>1&&<label className="bo-filter"><span className="bo-visually-hidden">Filter records</span><select value={status} onChange={e=>updateStatus(e.target.value)}><option value="all">All statuses</option>{filters.map(item=><option key={item} value={item}>{item}</option>)}</select></label>}
   <span className="bo-table-count" aria-live="polite">{matches.length} {matches.length===1?'record':'records'} in loaded set</span>
  </div>
  {matches.length?<><div className="bo-table-scroll"><table className="bo-table"><thead><tr>{columns.map(column=><th key={column} scope="col">{column}</th>)}</tr></thead><tbody>
  {shown.map(row=><tr key={row.id}>{columns.map((column,i)=>{const cell=row.cells[i];return <td key={`${row.id}-${column}`}>{cell?<span className={`${cell.kind==='status'?'bo-status':''} ${cell.kind==='amount'?'bo-cell-amount':''} ${cell.kind==='strong'?'bo-cell-strong':''} ${cell.kind==='muted'?'bo-cell-muted':''} ${cell.tone?'bo-tone-'+cell.tone:''}`}>{cell.href?<Link href={cell.href}>{cell.text}</Link>:cell.text}</span>:'—'}</td>})}</tr>)}
  </tbody></table></div><div className="bo-record-footer"><span>Showing {(current-1)*size+1}–{Math.min(current*size,matches.length)} of {matches.length}</span><div className="bo-page-buttons"><button type="button" disabled={current===1} onClick={()=>setPage(current-1)}>Previous</button><span>Page {current} of {pages}</span><button type="button" disabled={current>=pages} onClick={()=>setPage(current+1)}>Next</button></div></div></>:
   <div className="bo-record-empty"><span className="bo-record-empty-icon" aria-hidden="true">◎</span><strong>{rows.length? 'No matching records':emptyTitle}</strong><p>{rows.length?'Try another search term or filter.':emptyDescription}</p>{rows.length?<button type="button" onClick={()=>{updateSearch('');updateStatus('all')}}>Clear filters</button>:emptyHref&&emptyAction?<Link href={emptyHref} className="btn btn-primary">{emptyAction}</Link>:null}</div>}
  {limitNote&&<p className="bo-data-footnote">{limitNote}</p>}
 </div>;
}
