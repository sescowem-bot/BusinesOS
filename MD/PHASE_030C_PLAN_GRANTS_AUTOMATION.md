# Phase 030C — Cumulative plans, individual business grants, and Automation Studio

## Objectives

1. Subscription plans can inherit modules and staff-role access from a lower plan. Define e.g. Growth → Starter, Professional → Growth, Enterprise → Professional in `/admin/plans`. Existing plan IDs, prices, publication flags, subscriptions and direct feature settings are preserved. The migration does not seed or publish additional plans or invent prices.
2. An active System Owner may grant selected paid modules to one business in `/admin/businesses/[id]`, with optional expiry and selected staff roles. This is a **supplemental** grant, not a change to the underlying plan. Revoking it cannot revoke a module still included by the business's actual plan. A database audit row records every grant change. Manual payment and agreed prices can be referenced in the administrative note; no payment is charged.
3. A business owner can submit an automation request from `/automations/requests`, choose a workflow category and a preferred notification channel, and review quotations. System Owners can review requests at `/admin/automations` and record a quote, decline, or mark an accepted setup prepared. Status transitions are verified in database functions; ordinary business users cannot create or approve paid requests.
4. A real in-app notification is created for a new request and for status changes. **No automatic email sending, task scheduling, charge or external API dispatch is activated by migration 029.** Those need a separate safe execution pipeline, recipient consent, opt-out management, rate limits, retries and tested Resend integration.

## Deployment order

- Use a backup and test the SQL in a **staging Supabase project** first. Check that earlier migrations through `028_pilot_acceptance_register.sql` have been installed in the appropriate environment. Never rerun existing migrations.
- Apply **only** `supabase/migrations/029_cumulative_plans_business_grants_automation_requests.sql` as a single transaction in staging, then deploy updated Next.js source to Vercel Preview.
- Check the new **read-only** `MD/VERIFY_SQL_029_READ_ONLY.sql`. If you have already attempted the migration, inspect for partial objects before trying again. The migration is intentionally meant for first install.
- Run `npm run check:phase30c`, `npm run check:routes`, `npm run typecheck`, and `npm run build` in a working dependency environment. Run the existing regression checks, and verify server actions and Supabase RLS with two different business accounts and a non-admin account.
- Do not enable automatic notification emails or live customer automation merely because a quote has been accepted or marked configured.

## Acceptance tests (do not treat as passed until run)

1. Create Starter, Growth, Professional, Enterprise in CMS; make each inherit its preceding plan. Confirm the higher plan has every lower-tier module even if it enables no module directly.
2. Try to set Starter → Enterprise and verify circular inheritance is rejected. Confirm changing another plan does not affect the original plan's direct flags.
3. Sign in as an owner on a Growth business and a finance staff member on the same business. Verify entitlement checks follow both the inherited modules and staff role rules.
4. Grant extra Accounting to one Starter business for Owner and Finance, with a future expiry, and verify an unrelated Starter business has no access. Check the grant audit. Disable or expire the grant and confirm access is removed unless the assigned plan already provides it.
5. Sign in as a normal business user and attempt direct `admin_set_business_feature_grant` or `admin_set_plan_parent` RPC calls; both must be denied. Check cross-tenant SELECT under RLS.
6. Submit a custom automation request as a business owner; verify its tenant and creator, then confirm Platform Admin notifications. Issue a quote. Accept/decline it as the correct business owner, verifying invalid transitions are rejected and another business cannot alter it.
7. Confirm none of those actions sent an email, created a scheduler job or charged a payment. Email opt-in and job execution will be tested in the next stage.

## No-cost development approach

Only existing Next.js, Supabase and notification infrastructure are used. The custom automation request module does not depend on paid APIs, SMS gateways, AI model calls or physical POS devices. Supabase and email provider free-tier limits still apply; commercial hosting terms must be reviewed separately before launch.

## Rollback

Deploy the previous Next.js release and **leave migration 029 installed** until business grants, assignments and request records have been reviewed for dependency. Do not casually drop tables or restore an older snapshot over live customer data. A data-preserving rollback should be designed from actual post-migration records.

## Current verification

Route and static source checks are included; the production Next.js build, live Supabase migration, tenant/RLS checks, email delivery, payment confirmation and automation execution have **not** been verified here.
