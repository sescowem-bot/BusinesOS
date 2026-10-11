 'use server';
import {friendlyServiceError} from '@/lib/user-feedback';
import {revalidatePath} from 'next/cache';
import {getWorkspace} from '@/lib/server/workspace';
import {sendViaConfiguredResend} from '@/lib/notifications-email';
async function requireAdvancedTeam(w:Awaited<ReturnType<typeof getWorkspace>>){
 const {data,error}=await w.client.rpc('business_has_feature',{p_business_id:w.businessId,p_feature_key:'team'});
 if(error||data!==true)throw new Error('Advanced team and approval tools are not included in your current subscription.');
}
async function owner(){const w=await getWorkspace();if(w.role!=='owner')throw new Error('Only your business owner can manage team access.');return w;}
export async function inviteMember(form:FormData){const w=await owner();const email=String(form.get('email')||'').trim().toLowerCase();const role=String(form.get('role')||'staff');if(!['manager','sales','inventory','finance','staff'].includes(role)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Invalid invitation details');const {data:invitationId,error}=await w.client.rpc('create_team_invitation',{p_business_id:w.businessId,p_email:email,p_role:role});if(error)throw new Error(friendlyServiceError('invite this person', error));
 const {data:biz}=await w.client.from('businesses').select('name').eq('id',w.businessId).maybeSingle();
 const sent=await sendViaConfiguredResend({recipient:email,subject:`Invitation to join ${biz?.name||'a business'} on BusinessOS`,heading:'You are invited!',body:`${biz?.name||'A business'} invited you to join their team. Sign up or sign in using this email address, then accept your invitation.`,buttonLabel:'Accept invitation',actionUrl:`/invitation/${invitationId}`},`business-invite-${invitationId}`);
 if(!sent.ok)console.info('[team] invite saved; email delivery unavailable',sent.error);
 revalidatePath('/team');}
export async function addBranch(form:FormData){const w=await owner();await requireAdvancedTeam(w);const name=String(form.get('name')||'').trim(),code=String(form.get('code')||'').trim().toUpperCase(),address=String(form.get('address')||'').trim();if(name.length<2||name.length>120||!/^[A-Z0-9_-]{2,25}$/.test(code)||address.length>500)throw new Error('Invalid branch');const {error}=await w.client.from('business_branches').insert({business_id:w.businessId,name,code,address});if(error)throw new Error(friendlyServiceError('complete this request', error));revalidatePath('/team');}
export async function requestApproval(form:FormData){const w=await getWorkspace();await requireAdvancedTeam(w);const title=String(form.get('title')||'').trim(),details=String(form.get('details')||'').trim(),type=String(form.get('request_type')||'other');if(title.length<3||title.length>160||details.length>2000||!['expense','purchase','adjustment','other'].includes(type))throw new Error('Invalid request');const {data:{user}}=await w.client.auth.getUser();if(!user)throw new Error('Not authenticated');const {error}=await w.client.from('business_approval_requests').insert({business_id:w.businessId,title,details,request_type:type,requested_by:user.id});if(error)throw new Error(friendlyServiceError('complete this request', error));revalidatePath('/team');}
export async function reviewApproval(form:FormData){const w=await owner();await requireAdvancedTeam(w);const id=String(form.get('id')||''),approve=String(form.get('decision'))==='approved';if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid request');const {error}=await w.client.rpc('review_business_approval',{p_request_id:id,p_approve:approve,p_note:String(form.get('note')||'').slice(0,500)});if(error)throw new Error(friendlyServiceError('complete this request', error));revalidatePath('/team');}
export async function acceptInvitation(form:FormData){const w=await getWorkspace();const id=String(form.get('id')||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid invitation');const {error}=await w.client.rpc('accept_team_invitation',{p_invitation_id:id});if(error)throw new Error(friendlyServiceError('complete this request', error));revalidatePath('/team');}
/** Adjust an existing staff role with owner consent; business owners cannot transfer ownership here. */
export async function changeTeamRole(form:FormData){
 const w=await owner();const member=String(form.get('member')||''),role=String(form.get('role')||'');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(member)||
 !['manager','sales','inventory','finance','staff'].includes(role))throw new Error('Choose an existing member and permitted role');
 const {error}=await w.client.rpc('business_update_team_role',{p_business:w.businessId,p_member:member,p_role:role});
 if(error)throw new Error(friendlyServiceError('complete this request', error));revalidatePath('/team');
}

/** Set the name used for a member inside this business, without changing their login identity. */
export async function nameTeamMember(form:FormData){
 const w=await owner();
 const member=String(form.get('member')||'');const name=String(form.get('display_name')||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(member)||name.length<2||name.length>100)throw new Error('Select a team member and enter a name.');
 const {error}=await w.client.rpc('business_name_staff_member',{p_business:w.businessId,p_member:member,p_name:name});
 if(error)throw new Error(friendlyServiceError('save the team member name',error));
 revalidatePath('/team');revalidatePath('/tasks');
}
