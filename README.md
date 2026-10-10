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

## Phase 027 operational integrity

Inventory physical counts, source-accounting reconciliation, and tax-review safeguards are included. Read `MD/PHASE_027_RELEASE_NOTES.md` for the SQL prerequisite and rollout tests. The new migration is `supabase/migrations/027_inventory_counts_security.sql`. Do not enable new functionality in production until staging has passed.


## Phase 028 — Business Workspace Experience

The customer dashboard includes a responsive workspace sidebar, grouped operational navigation and an overview based on real business activity. See `MD/PHASE_028_BUSINESS_WORKSPACE_UX.md` for deployment, limitations and test instructions. Run `npm run check:phase28` alongside the existing checks.

## Phase 029 — Production quality gate

This source includes the Phase 029 reporting-completeness guard, protected infrastructure diagnostics, and expanded CI checks. Read [the release notes](MD/PHASE_029_RELEASE_NOTES.md) and [staging acceptance matrix](MD/PHASE_029_PRODUCTION_ACCEPTANCE.md). Run `npm run check:phase29`, `npm run typecheck` and `npm run build` before considering deployment. Database migrations are unchanged in Phase 029.


## Phase 030 — Controlled pilot readiness

System Owners can open `/admin/pilot` to record **Preview** and **Production** acceptance evidence, review blockers, and inspect limited read-only configuration signals. This feature **does not certify or launch** the platform automatically.

- Apply additive migration `supabase/migrations/028_pilot_acceptance_register.sql` after migration 027, **first in staging**.
- Review `MD/PHASE_030_PILOT_RELEASE_NOTES.md` and `MD/PHASE_029_PRODUCTION_ACCEPTANCE.md` for the release gate and manual acceptance tests.
- Run `npm run check:phase30` for code invariants.
- Run `npm run smoke:pilot -- https://YOUR-VERCEL-PREVIEW-URL` to check public pages and anonymous access boundaries without changing data.
- Run `npm run typecheck` and `npm run build` in an environment with installed dependencies. Supabase Auth Edge Functions are checked separately with Deno.

No customer records, subscription assignments or feature access flags are changed by the pilot tracker. Root-level Markdown documentation stays in `MD/`, leaving this `README.md` at the GitHub root.


## Phase 030B — Admin Console & Website Polish

For deployment details, see [`MD/PHASE_030B_ADMIN_CONSOLE_PRICING_HERO.md`](MD/PHASE_030B_ADMIN_CONSOLE_PRICING_HERO.md).
The public site has a server-role-aware Admin Console link, the System Owner navigation is searchable, pricing has illustrative categories alongside configured plan cards, and interior pages use distinct visuals. No new SQL is required.

## Phase 030C — Add-on subscription architecture and automation enquiries

Run migration `supabase/migrations/029_cumulative_plans_business_grants_automation_requests.sql` only after 028 is applied. See `MD/PHASE_030C_PLAN_GRANTS_AUTOMATION.md`. Higher plan inheritance is configured at `/admin/plans`, individual business extras at `/admin/businesses/[id]`, customer requests at `/automations/requests`, and Super Admin review at `/admin/automations`. No background jobs or automatic email sends are enabled by this migration.
