-- 016: Public marketing CMS and manually configured commercial plans
-- Run after 003_platform_branding.sql and later database migrations.
create table if not exists public.public_site_pages (
 slug text primary key check(slug ~ '^[a-z][a-z0-9-]{1,70}$'),
 title text not null, eyebrow text not null default '', description text not null default '',
 sections jsonb not null default '[]'::jsonb check(jsonb_typeof(sections)='array'),
 published boolean not null default false,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table if not exists public.public_site_plans (
 id text primary key check(id ~ '^[a-z][a-z0-9-]{1,70}$'),
 name text not null, price_label text not null default 'Contact sales', billing_label text not null default '',
 description text not null default '', features jsonb not null default '[]'::jsonb check(jsonb_typeof(features)='array'),
 cta_label text not null default 'Get started', cta_url text not null default '/contact',
 sort_order integer not null default 0, published boolean not null default false,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.public_site_pages enable row level security;
alter table public.public_site_plans enable row level security;
revoke all on public.public_site_pages,public.public_site_plans from anon,authenticated;
grant select on public.public_site_pages,public.public_site_plans to anon,authenticated;
grant insert,update,delete on public.public_site_pages,public.public_site_plans to authenticated;
create policy "published pages or administrator" on public.public_site_pages for select to anon,authenticated using (
 published or (select auth.uid()) in (select user_id from public.platform_admins where active)
);
create policy "administrator writes pages" on public.public_site_pages for all to authenticated
 using ((select auth.uid()) in (select user_id from public.platform_admins where active))
 with check ((select auth.uid()) in (select user_id from public.platform_admins where active));
create policy "published plans or administrator" on public.public_site_plans for select to anon,authenticated using (
 published or (select auth.uid()) in (select user_id from public.platform_admins where active)
);
create policy "administrator writes plans" on public.public_site_plans for all to authenticated
 using ((select auth.uid()) in (select user_id from public.platform_admins where active))
 with check ((select auth.uid()) in (select user_id from public.platform_admins where active));
-- Initial editorial content; subsequently editable from Super Admin. Do not overwrite existing edits.
insert into public.public_site_pages(slug,title,eyebrow,description,sections,published) values ('home','Run your business with clarity. Grow with confidence.','One workspace for your entire business','From customers and orders to accounting, stock and financial insights, bring the important parts of your business together in one thoughtful workspace.','[{"heading":"Everything you need to keep business moving.","body":"No more switching between notebooks, scattered messages and separate spreadsheets."}]'::jsonb,true) on conflict(slug) do nothing;
insert into public.public_site_pages(slug,title,eyebrow,description,sections,published) values ('features','Everything you need to run your business.','THE PLATFORM','Bring your records and operations together.','[{"heading":"Getting started","body":"Learn how this platform supports your business. Our team can customise this content from the CMS."}]'::jsonb,true) on conflict (slug) do nothing;
insert into public.public_site_pages(slug,title,eyebrow,description,sections,published) values ('solutions','A workspace for the way you do business.','SOLUTIONS','Tools for products, services and mixed businesses.','[{"heading":"Getting started","body":"Learn how this platform supports your business. Our team can customise this content from the CMS."}]'::jsonb,true) on conflict (slug) do nothing;
insert into public.public_site_pages(slug,title,eyebrow,description,sections,published) values ('how-it-works','Get organised in a few clear steps.','HOW IT WORKS','A straightforward start for your business.','[{"heading":"Getting started","body":"Learn how this platform supports your business. Our team can customise this content from the CMS."}]'::jsonb,true) on conflict (slug) do nothing;
insert into public.public_site_pages(slug,title,eyebrow,description,sections,published) values ('about','Built to make running a business clearer.','ABOUT','Practical software for growing businesses.','[{"heading":"Getting started","body":"Learn how this platform supports your business. Our team can customise this content from the CMS."}]'::jsonb,true) on conflict (slug) do nothing;
insert into public.public_site_pages(slug,title,eyebrow,description,sections,published) values ('resources','Practical guidance for growing businesses.','RESOURCES','Learn business records, pricing and compliance.','[{"heading":"Getting started","body":"Learn how this platform supports your business. Our team can customise this content from the CMS."}]'::jsonb,true) on conflict (slug) do nothing;
insert into public.public_site_pages(slug,title,eyebrow,description,sections,published) values ('contact','We would love to hear from you.','CONTACT','Contact the platform team.','[{"heading":"Getting started","body":"Learn how this platform supports your business. Our team can customise this content from the CMS."}]'::jsonb,true) on conflict (slug) do nothing;
insert into public.public_site_pages(slug,title,eyebrow,description,sections,published) values ('privacy','Privacy policy','LEGAL','Requires verified policy content before publishing.','[{"heading":"Getting started","body":"Learn how this platform supports your business. Our team can customise this content from the CMS."}]'::jsonb,false) on conflict (slug) do nothing;
insert into public.public_site_pages(slug,title,eyebrow,description,sections,published) values ('terms','Terms of service','LEGAL','Requires legal review before publishing.','[{"heading":"Getting started","body":"Learn how this platform supports your business. Our team can customise this content from the CMS."}]'::jsonb,false) on conflict (slug) do nothing;
insert into public.public_site_plans(id,name,price_label,billing_label,description,features,cta_label,cta_url,sort_order,published) values
('starter','Starter','Contact us','Pilot access','For small businesses organising everyday records','["Orders and customers","Payment tracking","Basic business records"]'::jsonb,'Request access','/contact',1,true),
('growth','Growth','Contact sales','Pricing to be confirmed','More business visibility and team workflows','["Reports foundation","Team workflows","Accounting records"]'::jsonb,'Talk to sales','/contact',2,true)
on conflict(id) do nothing;
