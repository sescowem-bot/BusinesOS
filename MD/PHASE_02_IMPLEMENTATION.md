# Phase 02 — Platform Super Admin & Identity

## Implemented
- Server-verified Supabase Auth user lookup and platform_admins role check.
- Platform administration UI with validated, server-action updates.
- Database-enforced read/update RLS and an automatic branding audit table.
- Public site metadata, homepage label, dashboard logo text, primary and accent theme colors read from a central branding record.
- Default branding shown while Supabase is not configured (read-only fallback).

## Deployment / migration
1. Ensure existing 001 and 002 migrations have been applied.
2. Apply `supabase/migrations/003_platform_branding.sql` in a controlled Supabase project.
3. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase (publishable/anon only). NEVER use service_role key on client.
4. Create/sign in with a real Supabase Auth user and seed that user UUID in `platform_admins` via the SQL editor. No user is automatically granted Super Admin.
5. Visit `/admin`; unauthorised users will receive a restricted page.
6. Change platform branding and confirm public homepage, metadata, dashboard header and audit records update.

## Limitations / remaining phase 02 work
- Login page now performs actual Supabase email/password sign-in and supports signing out. Existing signup/forgot-password flows remain demo-only and need separate production work.
- Logo/favicon accept hosted HTTPS URLs rather than storage uploads. Upload library and image validation come in the next increment.
- Existing app routes are demos and NOT production-secured. Do not deploy a public production service before completing authentication and tenant guards.
- The update path and SQL migration are not yet live-tested against a configured Supabase project.
- Other hardcoded brand references remain; central coverage started on the landing, metadata and dashboard shell.
