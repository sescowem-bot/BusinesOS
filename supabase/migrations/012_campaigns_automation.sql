-- Phase 11: safe campaign preparation and automation rules. No external sending.
create table public.contact_segments (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 120),
 filter_kind text not null check(filter_kind in ('all','with_email','with_phone')),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(id,business_id)
);
create table public.engagement_campaigns (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 120),
 segment_id uuid not null,channel text not null check(channel in ('email','sms')),
 subject text not null default '',body text not null check(length(trim(body)) between 1 and 5000),
 status text not null default 'draft' check(status in ('draft','scheduled','cancelled')),
 scheduled_at timestamptz,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(segment_id,business_id) references public.contact_segments(id,business_id),unique(id,business_id),
 check(status <> 'scheduled' or scheduled_at is not null)
);
create table public.engagement_automations (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 120),
 trigger_kind text not null check(trigger_kind in ('manual_review','order_created','payment_due','order_ready','birthday')),
 channel text not null check(channel in ('sms','email')),
 template_id uuid not null references public.communication_templates(id),
 delay_minutes integer not null default 0 check(delay_minutes between 0 and 43200),
 enabled boolean not null default false,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(id,business_id)
);
create table public.engagement_message_queue (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 campaign_id uuid not null, customer_id uuid not null,
 channel text not null check(channel in ('email','sms')),
 recipient text not null check(length(trim(recipient)) between 3 and 254),
 status text not null default 'preview' check(status in ('preview','cancelled')),
 created_at timestamptz not null default now(),
 foreign key(campaign_id,business_id) references public.engagement_campaigns(id,business_id) on delete cascade,
 unique(campaign_id,customer_id)
);
create index engagement_campaign_by_business on public.engagement_campaigns(business_id,created_at desc);
create index engagement_queue_by_campaign on public.engagement_message_queue(business_id,campaign_id);
create index engagement_automation_by_business on public.engagement_automations(business_id,created_at desc);
-- Preserve non-sending state even if front-end is compromised.
create or replace function public.engagement_guard_campaign_status() returns trigger language plpgsql as $$
begin
 if new.status not in ('draft','scheduled','cancelled') then raise exception 'Sending disabled';end if;
 return new;
end;$$;
create trigger enforce_campaign_safe_status before insert or update on public.engagement_campaigns for each row execute function public.engagement_guard_campaign_status();
-- Queue previews are generated via a single transaction and cannot be marked sent.
create or replace function public.engagement_preview_campaign(p_campaign uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_business uuid;v_channel text;v_segment text;v_count integer;
begin
 select c.business_id,c.channel,s.filter_kind into v_business,v_channel,v_segment
 from public.engagement_campaigns c join public.contact_segments s on s.id=c.segment_id and s.business_id=c.business_id
 where c.id=p_campaign and c.status in ('draft','scheduled');
 if v_business is null then raise exception 'Campaign unavailable';end if;
 if auth.uid() is null or not public.is_business_owner(v_business) then raise exception 'Not authorised';end if;
 -- Only business-linked contacts. No actual message delivery and no external API call.
 insert into public.engagement_message_queue(business_id,campaign_id,customer_id,channel,recipient)
 select v_business,p_campaign,bc.customer_id,v_channel,
 case when v_channel='email' then trim(cu.email) else trim(cu.phone) end
 from public.business_customers bc join public.customers cu on cu.id=bc.customer_id
 where bc.business_id=v_business
 and (v_segment='all' or (v_segment='with_email' and cu.email is not null) or (v_segment='with_phone' and cu.phone is not null))
 and case when v_channel='email' then nullif(trim(coalesce(cu.email,'')),'') is not null else nullif(trim(coalesce(cu.phone,'')),'') is not null end
 on conflict (campaign_id,customer_id) do nothing;
 select count(*) into v_count from public.engagement_message_queue where campaign_id=p_campaign;
 return v_count;
end;$$;
revoke all on function public.engagement_preview_campaign(uuid) from public,anon;
grant execute on function public.engagement_preview_campaign(uuid) to authenticated;
-- RLS plus explicit column restrictions: no direct update to queue status.
do $$ declare t text;begin
 foreach t in array array['contact_segments','engagement_campaigns','engagement_automations','engagement_message_queue'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('create policy %I on public.%I for select to authenticated using (public.is_business_member(business_id))',t||'_read',t);
 end loop;end $$;
create policy segments_create on public.contact_segments for insert to authenticated with check(public.is_business_owner(business_id) and created_by=auth.uid());
create policy campaigns_create on public.engagement_campaigns for insert to authenticated with check(public.is_business_owner(business_id) and created_by=auth.uid() and status='draft');
create policy automations_create on public.engagement_automations for insert to authenticated with check(public.is_business_owner(business_id) and created_by=auth.uid() and enabled=false and exists(select 1 from public.communication_templates t where t.id=template_id and t.business_id=engagement_automations.business_id and t.channel=engagement_automations.channel));
grant select on public.contact_segments,public.engagement_campaigns,public.engagement_automations,public.engagement_message_queue to authenticated;
grant insert on public.contact_segments,public.engagement_campaigns,public.engagement_automations to authenticated;
-- Marketing contacts require an additional explicit consent ledger before actual delivery.
-- There is deliberately no insert policy or insert grant for queue previews.
