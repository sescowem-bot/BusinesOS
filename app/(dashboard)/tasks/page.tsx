'use client';
import {useEffect,useState} from 'react';
import {PageHead,Card,Button,Badge} from '@/components/ui';
import {Plus,CheckCircle2,Clock3} from '@/components/icons';
import {useBusiness} from '@/lib/session';
import {getSupabaseBrowser} from '@/lib/supabase';

type Task={id:string;title:string;category:string;due_date:string|null;status:'open'|'done'};

export default function Tasks(){
  const{business,loading}=useBusiness();
  const[tasks,setTasks]=useState<Task[]>([]);
  const[title,setTitle]=useState('');
  const[category,setCategory]=useState('General');
  const[dueDate,setDueDate]=useState('');
  const[showForm,setShowForm]=useState(false);
  const[error,setError]=useState<string|null>(null);

  async function load(){
    const supabase=getSupabaseBrowser();
    if(!supabase||!business)return;
    const{data}=await supabase.from('tasks').select('id,title,category,due_date,status').eq('business_id',business.id).order('status',{ascending:true}).order('due_date',{ascending:true,nullsFirst:false});
    setTasks(data||[]);
  }

  useEffect(()=>{if(!loading&&business)load()},[business,loading]);

  async function addTask(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    if(!business)return;
    const supabase=getSupabaseBrowser();
    if(!supabase)return;
    const{error:insErr}=await supabase.from('tasks').insert({business_id:business.id,title,category,due_date:dueDate||null});
    if(insErr){setError(insErr.message);return}
    setTitle('');setDueDate('');setShowForm(false);
    load();
  }

  async function toggleDone(task:Task){
    const supabase=getSupabaseBrowser();
    if(!supabase)return;
    await supabase.from('tasks').update({status:task.status==='done'?'open':'done'}).eq('id',task.id);
    load();
  }

  if(!loading&&!business)return <div className="empty">Set up your business in Settings first.</div>;

  return <><PageHead title="Tasks & reminders" description="Keep important business actions from slipping through the cracks." action={<Button primary onClick={()=>setShowForm(s=>!s)}><Plus size={16}/> New task</Button>}/>{showForm&&<form onSubmit={addTask} className="form-card" style={{marginBottom:16}}><div className="form-grid"><div className="field full"><label>Task</label><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Follow up on Sarah's balance"/></div><div className="field"><label>Category</label><select value={category} onChange={e=>setCategory(e.target.value)}><option>General</option><option>Payment</option><option>Inventory</option><option>Quote</option><option>Order</option></select></div><div className="field"><label>Due date</label><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div></div>{error&&<p className="small" style={{color:'#d92d20'}}>{error}</p>}<div className="form-actions"><button type="submit" className="btn btn-primary">Save task</button></div></form>}<div className="grid grid-2">{tasks.map(t=><Card className="card-pad" key={t.id}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><div><b>{t.title}</b><p className="small muted">{t.category}{t.due_date?` · ${new Date(t.due_date).toLocaleDateString()}`:''}</p></div><Badge tone={t.status==='done'?'success':'warning'}>{t.status==='done'?'Done':'Open'}</Badge></div><div style={{marginTop:14}}>{t.status==='done'?<Button onClick={()=>toggleDone(t)}><CheckCircle2 size={15}/> Completed</Button>:<Button primary onClick={()=>toggleDone(t)}><Clock3 size={15}/> Mark done</Button>}</div></Card>)}{tasks.length===0&&<div className="empty">No tasks yet.</div>}</div></>;
}
