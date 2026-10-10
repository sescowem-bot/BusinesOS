> **Current prepared usability release:** Phase 030N-A — Mobile-first customer and business workflows. See `MD/PHASE_030N_A_USER_EXPERIENCE.md`. No additional SQL or environment variables; it requires the previous application database migrations to be installed.

> **Latest prepared upgrade:** Phase 030M-C, **Professional Business Dashboard, Estimated Profit Evidence and Support/Role Controls** (SQL 042). See `MD/PHASE_030M_C_DASHBOARD_ADMIN_SUPPORT.md`. Run only after SQL 041 is installed, and test in staging before production.

> Current prepared development: **Phase 030M-A — Wholesale Reference Tiers & Fast Retail Performance (SQL 041)**. See `MD/PHASE_030M_WHOLESALE_FAST_REPORTING.md`. Apply SQL 041 after SQL 040 in staging.

> **Latest prepared performance hotfix:** Public route caching, targeted Supabase proxy, request-scoped workspace verification and responsive loading states. Read `MD/PERFORMANCE_REVIEW_AND_OPTIMIZATION.md` before merging or deploying. No new SQL is required for this patch.

> New: **Phase 030L-B – Mobile signup/login and email delivery guidance**. See `MD/PHASE_030L_B_AUTH_EMAIL_AND_MOBILE_UX.md`. Supabase SMTP setup is a separate admin task; this code does not bypass email rate limits.

> Current prepared upgrade: **Phase 030K-B — Branch Stock Locations, Transfers & Counts (SQL 039)**. Test only in staging after Migration 038. See `MD/PHASE_030K_B_BRANCH_STOCK.md`.

> Previous release: **Phase 030J — Cashier Shifts & Reconciliation (SQL 037)**. Review `MD/PHASE_030J_CASHIER_RECONCILIATION.md` and `MD/PHASE_030J_ACCEPTANCE.md` before installation.

> Earlier source upgrade: **Order + Initial Payment UX (SQL 036)** — create unpaid, part-paid or fully paid orders in one transaction. See `MD/ORDER_PAYMENT_UX_RELEASE.md` for installation and test instructions.

> Earlier release: **Phase 030I POS Returns, Refunds & Commercial Credit Notes**. See `MD/PHASE_030I_RETURNS_REFUNDS_CREDIT_NOTES.md`; apply SQL 035 only after SQL 034. Test in staging; historical orders and invoices remain unchanged.

# BusinessOS

BusinessOS is a multi-tenant Next.js, TypeScript and Supabase business platform. System Owner administration (`/admin`) is separate from customer workspaces (`/dashboard`).

## Local setup

1. Copy `.env.example` to `.env.local` and provide only your project's intended **public** Supabase variables. Never expose a service-role key in a `NEXT_PUBLIC_` environment variable.
2. Install dependencies with `npm install`, commit the resulting `package-lock.json` (if none exists), and use `npm ci` in CI.
3. Run `npm run check:routes`, `npm run typecheck`, `npm run test:accounting`, and `npm run build`.
4. Configure `NEXT_PUBLIC_SITE_URL` and Supabase Auth's allowed redirect URLs before deploying.

## Database migrations

The current source includes migrations **001–039** (not all necessarily installed in your database). Existing deployments must apply only migrations they have not installed. Phase 025 introduces **`supabase/migrations/024_accounting_source_integration.sql`**, after 023. Make a database backup, test in staging, and obtain an accountant's approval before enabling production financial posting. Do not reset the database or repeat historical migrations.

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


## Phase 030D: Automation reminders

The latest source includes an optional, disabled-by-default reminder scheduler for Super Admin-approved task reminders. Read `MD/PHASE_030D_AUTOMATION_EXECUTION.md` before enabling it. First apply migration `030_automation_execution.sql` in staging after 029, then configure the private runner and test permissions and email opt-outs. Do not enable automatic email delivery in production without evidence of safe staging operation. No existing migrations should be rerun.


## Phase 030E — Software POS and Suppliers/Purchasing

The new `/pos` and `/purchasing` modules require SQL migration `031_pos_supplier_purchasing.sql`. See `MD/PHASE_030E_POS_PURCHASING.md` for prerequisites, permissions, deployment and staging acceptance tests. No external payment gateway or physical POS machine is required.

## Phase 030G — Reviewed POS VAT

Adds product-to-reviewed-supply mapping at `/pos/tax-mapping`, mixed-item VAT calculations for approved registered businesses, and VAT evidence on newly issued invoices. **Migration 033 is required after 032.** Full installation notes and staging tests: [`MD/PHASE_030G_REVIEWED_POS_VAT.md`](MD/PHASE_030G_REVIEWED_POS_VAT.md). Legacy POS is blocked for businesses marked VAT-registered until verified; no old invoice amounts are changed. Do not assume this replaces qualified tax review or NRS integration.

## Phase 030H — reviewed POS pricing (SQL 034)

The POS now supports reviewed VAT-inclusive or VAT-exclusive basket pricing and proportional pre-tax discounts. SQL 034 is required and must be installed after 033. No issued invoice is rewritten. See `MD/PHASE_030H_REVIEWED_POS_PRICING.md` for safety, deployment, test matrix, and limitations.

## Phase 030I — Controlled POS Returns

New routes: `/returns`, `/returns/[id]` and `/returns/credit-notes/[id]`.

The request, approval and recorded refund workflow is implemented. It uses a separately approved refund and a printable credit note; **no bank or card payment is initiated**. It does not automatically reconcile gross-sales reports, financial statements or VAT returns. Only eligible fully paid NGN POS sales without shipping qualify in this initial phase. See `MD/PHASE_030I_RETURNS_REFUNDS_CREDIT_NOTES.md` and the Phase 030I staging acceptance checklist.

SQL migration 035 must follow 034. Run `npm run check:phase30i`, `npm run typecheck`, `npm run build` and all staging acceptance tests before production enablement.


## Order creation and initial payments — migration 036

Both manual and reviewed-tax order forms can record zero, part or full payment during creation. The guarded database function creates the order and completed payment atomically, with an idempotency key. Install `036_order_creation_initial_payment.sql` after 035 in staging first; read `MD/ORDER_PAYMENT_UX_RELEASE.md`. The bank or card is **not** charged by this operation.

## Phase 030J — Cashier control (SQL 037)

Cashier shifts are available at `/pos/shifts` after database migration 037. Open and close tills, record physical cash movements, track cash payment capture, and document independent supervisor reviews. Daily report and unassigned cash exceptions are available for manager/owner roles. Do not interpret this as automated ledger posting, a card refund service or a complete all-channel bank reconciliation. First deploy in staging and run `npm run check:phase30j`.


## Phase 030K: Partial receiving and supplier records

See `MD/PHASE_030K_PARTIAL_RECEIPTS_SUPPLIER_BILLS.md`. SQL 038 must be applied after SQL 037 in staging. Branch-level inventory transfers are not yet safe because POS and returns use company-wide stock.


## Phase 030L — Premium Software POS (source release)

- SKU-based scanner entry and faster basket quantity controls.
- Cashier-private held carts, with resume/discard and no stock reservations.
- Two- or three-tender **recorded** split payments, committed atomically with the POS sale.
- Branded printable POS summary at `/pos/receipts/[id]`. Not an NRS-validated invoice.
- Database guard for registered-VAT POS sales, idempotency protections, and cashier shift integration.
- New SQL: `supabase/migrations/040_premium_pos_held_carts_split_tenders.sql` after 039.
- Docs: `MD/PHASE_030L_PREMIUM_POS.md`, `MD/PHASE_030L_ACCEPTANCE.md`, `MD/VERIFY_SQL_040_READ_ONLY.sql`.

**Deployment status:** Source package prepared only. SQL 040, TypeScript build, actual database concurrency tests and Vercel Preview acceptance have not been executed against a live installation.

## 030M fast retail reporting

Routes `/retail-reports` and `/wholesale` add bounded, indexed POS operational reporting and a reference bulk pricing catalogue. They do **not** automatically change VAT-reviewed POS prices or existing financial ledger statements. No new paid API is required. See the Phase 030M installation and staging checklist in `MD/`.

**Release gate:** the inherited source does not include `package-lock.json`. Generate and review one before requiring `npm ci`; run `npm run typecheck` and `npm run build` on a clean install before production.

## Phase 030M-C

Dashboard uses a compact SQL RPC, shows customer payment statuses and carefully qualified profit estimates. Owners/managers/finance can supply cost evidence; owners can manage existing team roles; Platform Admin can assist through an explicit customer-support workflow. SQL 042 is required. The app has **not** been deployed, migration 042 has **not** been executed, and a full Next.js production build has **not** been verified in this source session.
