'use client';
import {useActionState} from 'react';
import {configureAccounting,discoverAccountingSources,processAccountingSources,type IntegrationResult} from './integration-actions';
const initial:IntegrationResult={error:'',success:''};
type Account={id:string;code:string;name:string;class:string};
type Mapping={enabled:boolean;cash_account_id:string;receivable_account_id:string;advance_account_id:string;income_account_id:string;delivery_account_id:string;tax_account_id:string;expense_account_id:string};
function Feedback({value}:{value:IntegrationResult}){return <p aria-live="polite" role={value.error?'alert':'status'} className={value.error?'negative':'small muted'}>{value.error||value.success}</p>}
const mapping=[
 {key:'cash',field:'cash_account_id',label:'Bank / Cash',kind:'asset'},
 {key:'receivable',field:'receivable_account_id',label:'Accounts receivable',kind:'asset'},
 {key:'advance',field:'advance_account_id',label:'Customer advances',kind:'liability'},
 {key:'income',field:'income_account_id',label:'Sales income',kind:'income'},
 {key:'delivery',field:'delivery_account_id',label:'Delivery income',kind:'income'},
 {key:'tax',field:'tax_account_id',label:'Tax liability',kind:'liability'},
 {key:'expense',field:'expense_account_id',label:'Operating expenses',kind:'expense'},
] as const;
export function AccountingIntegrationForms({accounts,settings}:{accounts:Account[];settings:Mapping|null}){
 const [state,action,busy]=useActionState(configureAccounting,initial);
 const [found,find,scanning]=useActionState(discoverAccountingSources,initial);
 const [processed,process,posting]=useActionState(processAccountingSources,initial);
 return <div className="grid grid-2">
  <form action={action} className="tax-panel" style={{display:'grid',gap:13}}>
   <h3>Connect operational transactions</h3>
   <p className="small muted">Choose accounts from your own chart of accounts. Create missing accounts and an open period first. Nothing is enabled by default.</p>
   {mapping.map(m=><label key={m.key}>{m.label} <select name={m.key} required defaultValue={settings?.[m.field]||''}>
    <option value="">Select {m.kind} account</option>
    {accounts.filter(a=>a.class===m.kind).map(a=><option value={a.id} key={a.id}>{a.code} · {a.name}</option>)}
   </select></label>)}
   <label>Automatic journal posting <select name="enabled" defaultValue={settings?.enabled?'yes':'no'}><option value="no">Paused</option><option value="yes">Enabled for new transactions</option></select></label>
   <label style={{display:'flex',alignItems:'flex-start',gap:8}}><input type="checkbox" name="confirm_policy" value="yes"/>I have reviewed my accounts, the open period and the commercial invoice recognition policy.</label>
   <p className="muted small">Invoices debit receivables and recognise sales. Receipts debit cash and credit receivables or advances. Paid expenses debit expenses and credit cash. Existing source journals cannot be remapped automatically.</p>
   <button type="submit" className="btn primary" disabled={busy||accounts.length<5}>Save accounting integration</button><Feedback value={state}/>
  </form>
  <section className="tax-panel" style={{display:'grid',gap:12,alignContent:'start'}}>
   <h3>Reconciliation and historical records</h3>
   <p className="small muted">New invoices, completed payments and paid expenses enter the posting queue. Existing transactions are not imported until you choose to review them.</p>
   <form action={find}><button className="btn" disabled={scanning}>Find existing transactions</button><Feedback value={found}/></form>
   <p className="muted small">Review opening balances and previously entered manual journals with your accountant before posting historical records. The system cannot identify duplicates of manually posted entries.</p>
   <form action={process}><button className="btn primary" disabled={posting||!settings?.enabled}>Post next 20 pending entries</button><Feedback value={processed}/></form>
  </section>
 </div>;
}
