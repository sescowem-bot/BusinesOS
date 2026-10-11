'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export async function createTask(form:FormData){
 const {client,businessId,role}=await getWorkspace();
 if(role!=='owner'&&role!=='manager')throw new Error('Only an owner or manager can assign tasks.');
 const title=String(form.get('title')||'').trim();
 const details=String(form.get('details')||'').trim();
 const assigned=String(form.get('assigned_to')||'');
 const due=String(form.get('due_on')||'');
 if(title.length<3||title.length>180||details.length>1500||due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))throw new Error('Please check the task details.');
 const {error}=await client.rpc('business_save_task',{p_business:businessId,p_title:title,p_details:details,p_assigned:assigned||null,p_due_on:due||null});
 if(error){console.error('[tasks] create failed',error.code);throw new Error('We could not save that task. Please try again.');}
 revalidatePath('/tasks');
}
export async function updateTask(form:FormData){
 const {client,businessId}=await getWorkspace();
 const task=String(form.get('task_id')||'');
 if(!/^[0-9a-f-]{36}$/i.test(task))throw new Error('Please select a valid task.');
 const {error}=await client.rpc('business_set_task_completed',{p_business:businessId,p_task:task,p_completed:form.get('completed')==='true'});
 if(error){console.error('[tasks] complete failed',error.code);throw new Error('We could not update that task. Please try again.');}
 revalidatePath('/tasks');
}
