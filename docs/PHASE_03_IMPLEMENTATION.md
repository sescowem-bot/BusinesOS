# Phase 03 — Authentication and Access Foundation

## Implemented
- Real Supabase sign-up flow with password policy and optional email confirmation
- Password reset request, callback exchange, and reset form
- Authenticated dashboard route guard and first-business onboarding guard
- Authenticated atomic business workspace RPC migration (004)
- Configurable platform name on signup
- Login routes business users to their workspace, not platform admin

## Security limitations and next work
- Dashboard module pages still use sample data; authentication does NOT make these real data-backed features.
- Production needs rate limiting / abuse protection and CAPTCHA configuration in Supabase.
- Users can create multiple businesses; organisation switcher and roles need dedicated implementation.
- Confirm and restrict allowed Auth redirect URLs in Supabase configuration.
- Configure SMTP / email delivery provider and test sign-up, verification, recovery and logout.
- RLS requires database testing before production; no SQL migration was run against live Supabase.
- Platform admin branding should be tested against the applied migrations.
- Full mobile QA, integration tests, accessibility and actual Next.js build are not verified in this environment.

## Configuration
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL=https://your-domain.example

Apply migrations in sequence 001, 002, 003, 004; ensure migration 003 was applied only once. Configure email confirmation and Auth redirect URLs for https://your-domain.example/auth/callback and recovery URLs.
