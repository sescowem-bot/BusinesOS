-- Phase 020: safe additive notification foundation. Apply after migrations 001..019.
create table if not exists public.user_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 business_id uuid references public.businesses(id) on delete cascade,
 category text not null check (category in ('security','business','payment','order','inventory','tax','upgrade','system')),
 title text not null check (char_length(title) between 1 and 160),
 body text not null default '' check(char_length(body)<=2000),
 action_url text check (action_url is null or action_url ~ '^/[a-zA-Z0-9/_?=&.-]*$'),
 priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
 idempotency_key text,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index if not exists user_notifications_dedupe on public.user_notifications(recipient_id,idempotency_key) where idempotency_key is not null;
create index if not exists user_notifications_inbox_idx on public.user_notifications(recipient_id,created_at desc);
alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from anon,authenticated;
grant select on public.user_notifications to authenticated;
create policy "recipients may read own notifications" on public.user_notifications for select to authenticated using (recipient_id=(select auth.uid()));

create or replace function public.set_notification_read(p_id uuid, p_read boolean default true)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update public.user_notifications set read_at=case when p_read then now() else null end
 where id=p_id and recipient_id=(select auth.uid());
 return found;
end; $$;
revoke all on function public.set_notification_read(uuid,boolean) from public,anon;
grant execute on function public.set_notification_read(uuid,boolean) to authenticated;
-- Function uses invoker privileges; permit only updates to read_at, with recipient RLS update rule.
grant update(read_at) on public.user_notifications to authenticated;
create policy "recipients may update read state" on public.user_notifications for update to authenticated
using (recipient_id=(select auth.uid())) with check (recipient_id=(select auth.uid()));

create table if not exists public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email_business boolean not null default true,
 email_marketing boolean not null default false,
 in_app_business boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon,authenticated;
grant select,insert,update on public.notification_preferences to authenticated;
create policy "owner manages notification preferences" on public.notification_preferences for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.platform_email_templates (
 template_key text primary key check(template_key ~ '^[a-z][a-z0-9_]{1,70}$'),
 subject text not null check(char_length(subject) between 1 and 200),
 heading text not null default '',
 body_text text not null default '' check(char_length(body_text)<=10000),
 button_label text not null default '',
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table public.platform_email_templates enable row level security;
revoke all on public.platform_email_templates from anon,authenticated;
grant select,insert,update on public.platform_email_templates to authenticated;
create policy "platform admin reads templates" on public.platform_email_templates for select to authenticated
 using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.active));
create policy "platform admin edits templates" on public.platform_email_templates for all to authenticated
 using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.active))
 with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()) and a.active));
insert into public.platform_email_templates(template_key,subject,heading,body_text,button_label) values
('signup_confirmation','Confirm your email','Confirm your email','Please confirm your email address to activate your account.','Confirm email'),
('password_reset','Reset your password','Password reset requested','Use the secure link to reset your password.','Reset password'),
('business_invitation','You are invited to a business workspace','You have an invitation','You have been invited to join a business workspace.','View invitation'),
('upgrade_decision','Your plan request has been reviewed','Plan request update','Your business plan request has been reviewed.','View your plan')
on conflict(template_key) do nothing;

-- Actual workflow events: an upgrade request notifies the business owner and active platform admins.
-- Uses the same trusted database transaction; users cannot insert arbitrary notifications.
create or replace function public.notify_upgrade_request_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin record; v_name text;
begin
 select name into v_name from public.businesses where id=new.business_id;
 if tg_op='INSERT' then
  for v_admin in select user_id from public.platform_admins where active loop
   insert into public.user_notifications(recipient_id,business_id,category,title,body,action_url,priority,idempotency_key)
   values(v_admin.user_id,new.business_id,'upgrade','New plan upgrade request',coalesce(v_name,'A business')||' requested plan '||new.plan_id||'.','/admin/upgrades','high','upgrade-request:'||new.id::text)
   on conflict do nothing;
  end loop;
 elsif tg_op='UPDATE' and old.status='pending' and new.status in ('approved','rejected') then
  insert into public.user_notifications(recipient_id,business_id,category,title,body,action_url,priority,idempotency_key)
  values(new.requested_by,new.business_id,'upgrade','Upgrade request '||new.status,
         'Your plan request for '||new.plan_id||' was '||new.status||'.','/upgrade','normal','upgrade-decision:'||new.id::text)
  on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.notify_upgrade_request_event() from public,anon,authenticated;
drop trigger if exists trg_notify_upgrade_request_event on public.business_upgrade_requests;
create trigger trg_notify_upgrade_request_event after insert or update of status
on public.business_upgrade_requests for each row execute function public.notify_upgrade_request_event();
