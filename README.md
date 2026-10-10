# BusinessOS

BusinessOS is a multi-tenant Next.js, TypeScript and Supabase business platform. System Owner administration (`/admin`) is separate from customer workspaces (`/dashboard`).

## Local setup

1. Copy `.env.example` to `.env.local` and provide only your project's intended **public** Supabase variables. Never expose a service-role key in a `NEXT_PUBLIC_` environment variable.
2. Install dependencies with `npm install`, commit the resulting `package-lock.json` (if none exists), and use `npm ci` in CI.
3. Run `npm run check:routes`, `npm run typecheck`, `npm run test:accounting`, and `npm run build`.
4. Configure `NEXT_PUBLIC_SITE_URL` and Supabase Auth's allowed redirect URLs before deploying.

## Database migrations

The current source includes migrations **001–026**. Existing deployments must apply only migrations they have not installed. Phase 025 introduces **`supabase/migrations/024_accounting_source_integration.sql`**, after 023. Make a database backup, test in staging, and obtain an accountant's approval before enabling production financial posting. Do not reset the database or repeat historical migrations.

## Documentation

All project Markdown documentation, except this GitHub `README.md`, lives in [`MD/`](MD/). The Phase 025 release guide is [`MD/PHASE_025_ACCOUNTING_INTEGRATION.md`](MD/PHASE_025_ACCOUNTING_INTEGRATION.md). Read that guide before enabling ledger automation or importing historical transactions.

## Deployment

The automatic accounting bridge is **disabled by default** and requires chart mappings, an open period, appropriate permissions and explicit activation. Incomplete source events are visible to finance staff; no expense/payment is silently assumed to have posted. External payment gateway integration and statutory tax submissions are not enabled.

## Phase 026: Email, notifications and brand media

Read [`MD/PHASE_026_COMPLETE_GUIDE.md`](MD/PHASE_026_COMPLETE_GUIDE.md) before installation. It includes SQL 025 (email delivery records) and SQL 026 (public brand asset storage). The System Owner can upload logo and favicon files from `/admin/website`, while email previews and provider test sending are managed from `/admin/email`. Existing Supabase authentication email sending is retained until the optional signed Auth Hook has been tested in staging. No secrets belong in `NEXT_PUBLIC_*` variables.
