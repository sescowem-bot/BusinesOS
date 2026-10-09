-- Phase 10: in-app messaging, customer context and safe provider configuration.
-- Apply after migration 010. All external sending is intentionally disabled.
create table if not exists public.communication_conversations (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 customer_id uuid references public.customers(id) on delete set null,
 subject text not null check(length(subject) between 1 and 180),
 status text not null default 'open' check(status in ('open','closed')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (id,business_id)
);
create table if not exists public.communication_messages (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null,
 conversation_id uuid not null,
 sender_id uuid not null references auth.users(id),
 channel text not null default 'internal' check(channel in ('internal','email','sms')),
 direction text not null default 'internal' check(direction in ('internal','outbound','inbound')),
 body text not null check(length(trim(body)) between 1 and 5000),
 status text not null default 'saved' check(status in ('saved','draft','queued','sent','delivered','failed')),
 created_at timestamptz not null default now(),
 foreign key (conversation_id,business_id) references public.communication_conversations(id,business_id) on delete cascade,
 check(channel <> 'internal' or direction='internal'),
 check(channel = 'internal' or status in ('draft','saved'))
);
create table if not exists public.communication_templates (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null check(length(name) between 1 and 100),
 channel text not null check(channel in ('internal','email','sms')),
 subject text not null default '',
 body text not null check(length(trim(body)) between 1 and 5000),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.communication_channel_settings (
 business_id uuid not null references public.businesses(id) on delete cascade,
 channel text not null check(channel in ('email','sms')),
 provider text not null default 'not_configured' check(length(provider) <= 80),
 sender_identity text not null default '' check(length(sender_identity) <= 180),
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(business_id,channel),
 constraint communication_sending_disabled check(enabled=false)
);
create index if not exists comm_conversations_business_idx on public.communication_conversations(business_id,updated_at desc);
create index if not exists comm_messages_thread_idx on public.communication_messages(business_id,conversation_id,created_at);
create index if not exists comm_templates_business_idx on public.communication_templates(business_id,channel);
alter table public.communication_conversations enable row level security;
alter table public.communication_messages enable row level security;
alter table public.communication_templates enable row level security;
alter table public.communication_channel_settings enable row level security;
create policy comm_threads_read on public.communication_conversations for select to authenticated using(public.is_business_member(business_id));
create policy comm_threads_insert on public.communication_conversations for insert to authenticated with check(public.is_business_member(business_id) and created_by=auth.uid() and status='open' and (customer_id is null or exists(select 1 from public.business_customers bc where bc.business_id=communication_conversations.business_id and bc.customer_id=communication_conversations.customer_id)));
create policy comm_messages_read on public.communication_messages for select to authenticated using(public.is_business_member(business_id));
create policy comm_messages_insert on public.communication_messages for insert to authenticated with check(public.is_business_member(business_id) and sender_id=auth.uid() and status in ('saved','draft') and ((channel='internal' and direction='internal') or (channel in ('email','sms') and direction='outbound' and status='draft')));
create policy comm_templates_read on public.communication_templates for select to authenticated using(public.is_business_member(business_id));
create policy comm_templates_insert on public.communication_templates for insert to authenticated with check(public.is_business_member(business_id) and created_by=auth.uid());
create policy comm_channel_settings_read on public.communication_channel_settings for select to authenticated using(public.is_business_member(business_id));
create policy comm_channel_settings_owner_insert on public.communication_channel_settings for insert to authenticated with check(public.is_business_owner(business_id) and enabled=false);
create policy comm_channel_settings_owner_update on public.communication_channel_settings for update to authenticated using(public.is_business_owner(business_id)) with check(public.is_business_owner(business_id) and enabled=false);
revoke all on public.communication_conversations,public.communication_messages,public.communication_templates,public.communication_channel_settings from anon;
grant select,insert on public.communication_conversations,public.communication_messages,public.communication_templates to authenticated;
grant select,insert,update on public.communication_channel_settings to authenticated;
-- No external send operations, API keys, webhooks or public messaging endpoints in Phase 10.
