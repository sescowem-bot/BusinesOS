# Phase 024C — Dynamic pricing plans and role permissions

## Why this change
The existing site seeded only two plans (Starter and Growth), even though the CMS could technically create more. The pricing list relied on editable prose and was disconnected from the nine premium access flags. Plan feature checks did not respect configurable business roles in the database. This update removes the two-plan UI assumption and makes plan descriptions reflect the configured feature catalogue.

## New pages
- `/admin/plans` — Create as many plan records as needed, edit prices, marketing notes, CTAs, publication and order. Plan creation still uses the existing protected Supabase `public_site_plans` table. New plans start in draft, with premium features disabled.
- `/admin/plan-access` — Configure access to 9 premium modules and per-plan permissions for 5 staff roles. Owners retain access to all enabled modules on their approved plan.
- `/pricing` — Dynamic unlimited plan cards with a complete comparison of 8 essential capabilities and 9 optional modules, based on published plans and verified entitlements rather than invented data.
- `/upgrade` — Published plan comparison now checks the database-driven public module catalogue, even for plans not yet assigned to a business.

## Migration 023
**File:** `supabase/migrations/023_dynamic_plans_role_permissions.sql`

Run only after migrations 016–022 that are required by your current source. In particular, 016 (CMS), 017 (plan assignments), 019 (feature access), 021 (admin review), and 022 (invoices) should be installed for the full app. Verify which are already installed before proceeding.

The migration adds `platform_plan_role_features`, plus `admin_save_plan_permissions` (atomic, admin-only save), `admin_set_plan_role_feature` (admin-only individual update), and `published_plan_features` (public read of active features for published plans only). It replaces `business_has_feature` to check **both authenticated business membership and approved plan + role access**. It does not overwrite existing plan records, prices, assignments, user data or CMS changes.

After deployment:
1. Sign in with an active Super Admin account.
2. Go to `/admin/plans` and create or edit your plans, including pricing and publication state. Each plan requires a unique slug-like identifier.
3. Open `/admin/plan-access`; expand each plan, toggle premium modules, select allowed staff roles, and save. All 9 modules are shown per plan.
4. Visit `/pricing` in a private browsing window. Check that only published plans appear and the module table matches your admin configuration.
5. Sign in as a business owner and request an upgrade in `/upgrade`; approve in `/admin/upgrades` as a Super Admin.
6. Verify an allowed role accesses a premium page and a denied role cannot access its server actions.

## Important conditions
- **Existing approved plan assignments stay unchanged.** An admin's changes to module permissions for a plan take effect for *all businesses currently on that plan*.
- Role permissions use the six existing database roles: owner, manager, finance, sales, inventory and staff. This is not a new custom role-creation interface, which needs a different RBAC migration.
- **8 core features remain available regardless of plan** under the original migration-019 policy; this upgrade only customises the nine extra modules. Full per-plan quotas, metered billing and paid provider integrations are not added.
- Public feature information is a catalogue of available modules, **not a claim that all third-party integrations are active**. External SMS/WhatsApp/email sending, automatic bookkeeping, formal tax filing and other unfinished endpoints remain subject to later testing/integration.
- Direct database RLS and every business operation need an end-to-end access audit before commercial launch. The role-aware `business_has_feature` function is an important gate, but not proof of full entitlement enforcement across every unrelated endpoint.
- Upgrades still require explicit Super Admin approval. This release does not create or collect payments.
- No plan is deleted automatically; old records are preserved. Keeping plans unpublished prevents new upgrade requests, but does not delete approved assignments.

## Verification performed in the working environment
- `node scripts/check-routes.cjs` — 54 unique routes and no duplicates.
- `node scripts/verify-dynamic-plans.cjs` — structural and safety invariants passed.
- `node scripts/verify-phase21.cjs` — TypeScript/TSX syntax parse and calculation/reporting/tax tests passed.
- Existing dual-workspace checks passed.
- **Not verified:** A complete `next build`/`tsc --noEmit` (npm install timed out here), execution on live Supabase, full RLS/role matrix integration, or Vercel deployment. Please run these checks in a staging environment and review Vercel build logs.

## Rollout recommendation
Apply additive migration 023 to a staging project, deploy the source to a preview environment, configure one unpublished test plan, test role access with separate staff accounts, and only then publish the new pricing. Do not rerun earlier migrations and do not expose secret keys in frontend environment variables.
