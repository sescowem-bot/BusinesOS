# BusinessOS Phase 030N-I — Platform identity, subscription control, internal updates and exports

## Source of truth

This release **extends the UNPUSHED Phase 030N-H full-source package**. The public GitHub `main` branch is older (for example Tasks is still a placeholder and SQL 047 is not present). **Do not overwrite this package with a GitHub pull or older zip.** Compare and merge later commits deliberately.

## The two administrators are different

* **System Owner / Platform Administrator** manages BusinessOS platform brand name, tagline, theme colours, logo, favicon, site content, published plans, monthly/yearly NGN pricing, plan module permissions, manual plan assignments, audits, and business listing verification. This role does NOT grant access to a customer's private orders, payments or conversations.
* **Business owner** is the initial workspace membership role. Their Free or paid **subscription** determines which premium modules exist; their own membership lets them operate the business and invite employees. Employees get the intersection of the available plan features and their restricted staff-role permissions. A registered business does not need the System Owner to approve its normal activities.

## Done in this source update

1. Plan-aware sidebar already implemented in SQL 046 and the workspace shell is preserved; unentitled premium modules are omitted. The `/exports` and `/team/updates` pages are intentionally core tools. Advanced branches and approval requests require the `team` subscription entitlement in both server actions and database triggers.
2. `/admin/website` contains platform name, slogan, colors, logo and favicon settings. This release makes the branding studio clear and supplies configured platform name to the installation guide. Branding is distinct from each business's settings.
3. `/admin/plans` edits monthly and yearly prices. `/admin/plan-access` configures enabled module types and staff-role permissions for every plan; Free stays core-only. The `/pricing` and `/upgrade` comparison screens reflect actual published plans and omit unreleased Campaigns from customer benefit lists. Plans with no usable price cannot be checked out. Do not assign invented example prices.
4. `/admin/businesses/[id]` now lets the System Owner make an explicit **manual plan assignment** (published plan, future optional expiry, required reason, audited change). This uses the database RPC in SQL 048; customer transactions are not available from this tool. Manual assignment does not charge the client.
5. The existing Paystack verified checkout from Phase 030N-H / SQL 047 remains. A successful payment should activate a paid plan without a person approving it. **It is not a tested live checkout yet.** PAYSTACK_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY must stay private on Vercel. Enter published, positive numeric monthly or yearly prices before selling plans.
6. `/team/updates` is now a private internal notice board for **members of one business**, implemented in SQL 048. It has no customer chat, email, SMS delivery or push notification semantics. Customer follow-up notes are a distinct, premium module (`/communications`).
7. `/exports` provides owner-only, Excel-compatible CSV files for customers, products, orders, payments, expenses and issued commercial invoices. The data is scoped to the active business and RLS. CSV is formula-injection guarded. Export refuses to silently truncate beyond 10,000 records per category. The printable summary (via browser Print → Save as PDF) contains verified record counts only, **not** an accountant-certified statement, archive of every record, or full PDF data dump. Invoice pages already have printable versions.
8. Navigation prefetch stays disabled for heavy authenticated menu routes. Exports query data only when opened. Lightweight CSS-based loader preserved. Actual latency requires Vercel/Supabase diagnostics.

## Installation prerequisites

1. Back up database and source. Check SQL 044/045 objects and the dashboard on staging first; these were not confirmed live in this chat. Then verify and apply SQL 046 and 047 in order.
2. Run `supabase/migrations/048_admin_plan_controls_team_updates.sql` **once in staging AFTER 047** and then `MD/VERIFY_SQL_048_READ_ONLY.sql`. Never run it against a partially migrated database.
3. Apply source to a Git review branch and test via Vercel Preview. Do not copy production secrets to browser/public environment variables.
4. Add numeric published plan prices in **System Owner → Pricing Plans** and permitted roles in **Plan Access & Roles**. Test Free plan against a fresh business. Verify staff invitations and invite acceptance with two separate user accounts.
5. For paid checkout, enter **PAYSTACK_SECRET_KEY** and **SUPABASE_SERVICE_ROLE_KEY** as Vercel *server-only* variables; verify Paystack callback and webhook, amount, signature, replay prevention, and role before production. Never promise successful activation until tested with real/sandbox provider responses.

## Pitch demonstration (realistic)

Use a **preview environment** seeded with test records and accounts, not private client data. Walk through: System Owner branding studio → Free business onboarding → create customer and product → create order and record an externally verified payment → customer invoice print → invite colleague and post team update → CSV export → show published plan comparison/pricing → show admin manual plan controls. Show Paystack live checkout **only if keys, migrations, test transaction and verified activation have passed**. Public directory features require SQL 046, verified listing and explicit business consent.

## Not yet complete / release blockers

* Complete production build and TypeScript typecheck unavailable in this environment (npm registry DNS failed). GitHub Actions must run these first.
* Live SQL 044–048 installation, RLS integration, iOS Home Screen test, email invitation delivery, and Paystack test transaction all pending.
* No automatic recurring subscription billing, refund or chargeback reconciliation yet; manual assignments do not perform a payment.
* No customer acquisition/leads engine. The public business directory is opt-in discovery, not a promise of referrals.
* Internal team updates are notices, not real-time team chat or customer chat. Customer messages are saved internal notes/drafts; sending is not enabled.
* Existing accounting financial statements remain dependent on journal posting and reconciliation. The printable export summary is NOT an audited PDF statement.
* Brand name/colour changes update website and manifest; OS-cached pinned app icons may require re-install. The PWA icon files remain static unless explicitly replaced.
* Per-plan seat limits, automatic staff-permission presets, bulk XLSX, large asynchronous exports, and backend invoice PDF storage are future work. The existing 11 licensed module keys are broader than the detailed workflows displayed in the catalog; those workflows are not individually permissioned.
* Platform Admin can inspect **subscription/business-directory metadata only**, not client private business records without explicit approved support access.

## Verification scope

Run `node scripts/check-routes.cjs`, `node scripts/verify-product-ux-release.cjs`, other `node scripts/verify-*.cjs`, `npm run typecheck`, and `npm run build` after npm dependencies are installed. Source/syntax/regression checks cannot replace production compilation or browser/backend integration tests.
