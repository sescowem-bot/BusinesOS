# BusinessOS

Multi-tenant Next.js / React / TypeScript / Supabase platform for small and growing businesses. Platform administration (`/admin`) is separate from business member workspaces (`/dashboard`).

## Install & check

1. Copy `.env.example` to `.env.local` for local development and supply the project's public Supabase URL/key. Never expose a Supabase service-role key to the browser.
2. Run `npm install` on a machine with npm registry access, commit the resulting `package-lock.json`, and use `npm ci` on CI/production.
3. Run `npm run check:routes`, `npm run check:phase21`, `npm run typecheck`, `npm run build`.
4. Run `npm run dev` locally. Configure the site origin in `NEXT_PUBLIC_SITE_URL` and the matching allowed redirect in Supabase Auth.

## Database

Existing projects previously applied migrations 001–020. **Phase 021 has no new database migration**. Do not reinstall historical migrations. `docs/PHASE_021_DATABASE_PREFLIGHT_READ_ONLY.sql` checks expected schema objects safely.

## Deployment status

See `docs/PHASE_021_RELEASE_NOTES.md` and `docs/PHASE_021_DEPLOY_AND_ACCEPTANCE_TESTS.md`. A successful code audit is not a production deployment. Email delivery activation, complete RBAC/RLS verification and operational accounting integration remain separate tasks.

## Phase 022 extension

The latest source includes secure Super Admin business-review details and a no-code CMS section editor. Apply `supabase/migrations/021_admin_business_review.sql` after migration 020, and consult `docs/PHASE_022_RELEASE_NOTES.md` for limitations, staging checks and rollout steps.
