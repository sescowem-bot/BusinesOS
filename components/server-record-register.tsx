import Link from 'next/link';
import type {RecordItem} from '@/components/business-records';
import {directoryHref} from '@/lib/record-directory';
import styles from './server-record-register.module.css';

type StatusOption={value:string;label:string};
type Props={
 route:string; columns:string[]; rows:RecordItem[]; page:number; pageSize:number; count:number|null;
 q:string; status?:string; customer?:string|null; searchLabel:string; filterOptions?:StatusOption[];
 emptyTitle:string; emptyDescription:string; emptyHref?:string; emptyAction?:string; note?:string;
};
/** A true server-paginated register. Searching or page changes never filter a capped client-side dataset. */
export function ServerRecordRegister({route,columns,rows,page,pageSize,count,q,status='',customer=null,searchLabel,filterOptions=[],
 emptyTitle,emptyDescription,emptyHref,emptyAction,note}:Props){
 const from=(page-1)*pageSize;
 const to=from+rows.length;
 const hasNext=count===null?rows.length===pageSize:to<count;
 const clearHref=directoryHref(route,{customer});
 return <div className="bo-records">
  <form className={styles.filters} action={route} method="get" role="search" aria-label={searchLabel}>
   {customer&&<input type="hidden" name="customer" value={customer}/>}
   <label className={styles.search}><span className={styles.label}>{searchLabel}</span>
    <input type="search" name="q" defaultValue={q} maxLength={80} placeholder={searchLabel} autoComplete="off"/>
   </label>
   {filterOptions.length>0&&<label className={styles.select}><span className={styles.label}>Status</span>
    <select name="status" defaultValue={status}><option value="">All statuses</option>
     {filterOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
   </label>}
   <button className="btn btn-primary" type="submit">Search records</button>
   {(q||status)&&<Link className="btn" href={clearHref} prefetch={false}>Clear</Link>}
  </form>
  <div className={styles.meta} aria-live="polite">
   <span>{count===null?`Showing ${rows.length} on this page`:`${count.toLocaleString('en-NG')} matching ${count===1?'record':'records'}`}</span>
   <span>Page {page}</span>
  </div>
  {rows.length?<div className="bo-table-scroll" role="region" aria-label={searchLabel+' results'} tabIndex={0}>
   <table className="bo-table"><thead><tr>{columns.map(column=><th key={column} scope="col">{column}</th>)}</tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}>{columns.map((column,i)=>{
     const cell=row.cells[i];return <td key={row.id+'-'+column} data-label={column}>{cell?
      <span className={[`bo-cell-${cell.kind||'plain'}`,cell.kind==='status'?'bo-status':'',cell.tone?'bo-tone-'+cell.tone:''].join(' ')}>
       {cell.href?<Link href={cell.href}>{cell.text}</Link>:cell.text}</span>:'—'}</td>;
    })}</tr>)}</tbody>
   </table>
  </div>:<div className="bo-record-empty"><strong>{q||status?'No records match your search':emptyTitle}</strong>
   <p>{q||status?'Try another search or clear the filters.':emptyDescription}</p>
   {(q||status)?<Link className="btn" href={clearHref} prefetch={false}>Clear search</Link>:emptyHref&&emptyAction?
    <Link className="btn btn-primary" href={emptyHref}>{emptyAction}</Link>:null}
  </div>}
  <nav className={styles.pager} aria-label="Record pages">
   <span>{rows.length?`Showing ${from+1}–${to}`:'No records on this page'}{count!==null?` of ${count.toLocaleString('en-NG')}`:''}</span>
   <div className={styles.actions}>
    {page>1?<Link className="btn" href={directoryHref(route,{page:page-1,q,status,customer})} prefetch={false}>← Previous</Link>:null}
    {hasNext?<Link className="btn" href={directoryHref(route,{page:page+1,q,status,customer})} prefetch={false}>Next →</Link>:null}
   </div>
  </nav>
  {note&&<p className="bo-data-footnote">{note}</p>}
 </div>;
}
