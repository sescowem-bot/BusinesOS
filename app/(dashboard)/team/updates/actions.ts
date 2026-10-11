'use server';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
export async function postTeamUpdate(data:FormData){
 const w=await getWorkspace();const body=String(data.get('message')||'').trim();
 if(!body||body.length>2000)throw new Error('Write a message with up to 2,000 characters.');
 const {error}=await w.client.rpc('business_post_team_update',{p_business:w.businessId,p_body:body});
 if(error){console.error('[team-updates] save failed',error.code);throw new Error('Your team update could not be saved. Please try again.');}
 revalidatePath('/team/updates');
}
