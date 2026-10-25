> **Later status (25 October 2026):** Phase 1G activated the global action switch with zero preset overrides after SQL acceptance. The OFF-state notes below are historical. See [Phase 1G activation and acceptance](PHASE1G_ACTIVATION_ACCEPTANCE_20261025.md).

# BusinessOS Phase 1E–1F: Direct-API hardening and View permission coverage

**25 October 2026 — implementation deployed to production database; final role-matrix activation still pending.**

## Production changes verified

Three database migrations, already applied; **DO NOT execute the GitHub SQL snapshots again**:

- `20261025212905_businessos_phase1e_revoke_data_api_table_ddl_privileges`: removes TRUNCATE/TRIGGER/REFERENCES from PUBLIC, anon and authenticated on all public tables, without removing ordinary SELECT/INSERT/UPDATE/DELETE or service-role grants. Verified zero ordinary-user TRUNCATE and TRIGGER privileges remain.
- `20261025213019_businessos_phase1e_remaining_rest_action_guards`: adds 19 restrictive INSERT/UPDATE/DELETE policies on invoice profiles, tax profiles, supply categories, engagement automations, quote items, installment schedules and business settings. Owners can still maintain essential tax-discovery profiles via **Settings**, independent of premium Tax Centre. Direct business DELETE via the ordinary API was revoked; use the audited lifecycle process.
- `20261025213253_businessos_phase1f_one_query_workspace_visible_modules`: authenticated `business_visible_modules(uuid)` returns only modules with an active membership and allowed View action. Anonymous cannot execute; nonmember/nonexistent business returns an empty array. The single RPC covers all 19 configured modules.

At the final read-only audit: **70 restrictive Phase 1 policies across 24 tables**. The global per-role action matrix was still **OFF**, with **0 saved overrides**. All four plan inheritance links were valid; all 32 core feature settings were enabled, as previously configured.

## Application release scope

- Dashboard Shell calls a single request-cached module visibility resolver (not 19 separate RPC calls). It filters sidebar, search and mobile navigation using the same database decision.
- Core pages (Customers, Orders, Products, Payments, Expenses, Invoices, Settings, Receivables and Exports) require View permission in their server layouts.
- Premium routes (POS, Returns, Wholesale, Inventory, Purchasing, Accounting, Reports, Retail Reports, Tax Centre, Communications, Insights and Growth) require the corresponding View action even when opened by a direct URL.
- Tasks and Team Updates use the premium Team entitlement. Basic team membership/invitation management remains available through the separate /team page and has SQL owner/Settings controls.
- Tax Discovery at /tax-profile stays accessible as an essential compliance-input workflow; premium Tax Centre/Tax Compliance require the paid Tax View authorization.
- Optional premium feature checks also use the cached View outcome and preserve the original database subscription checks.

## Verification done without changing customer data

A production read-only transaction simulated JWT identity for existing active Owner memberships and checked that all eight enabled core modules were visible and unrelated business IDs returned no visible modules. No database rows were inserted, changed or deleted; transaction rolled back successfully. This is a **database helper smoke test**, not a real browser login or true RLS impersonation test.

Current production has **six Owner memberships only**. There are no Manager, Sales, Finance, Inventory or Staff test memberships available for signed-in acceptance testing. Their full end-to-end permission paths have therefore **not** been verified.

## Why final activation remains pending

The global `platform_plan_action_enforcement.enabled` flag is OFF and `platform_plan_action_overrides` contains zero configured decisions. Until authenticated tests with all roles and plans pass, switching it on would create risks to paid checkout, refunds, internal approvals, accounting and permission inheritance. A source/unit test alone cannot certify those multi-step paths.

Remaining release gate:
1. Create or designate legitimate non-production-data test memberships (at least Manager, Sales, Finance, Inventory, Staff) with authenticated sessions, and run positive/negative UI, direct REST and direct RPC checks.
2. Save audited Deny decisions, verify immediate effect, verify Allow cannot bypass a disabled module, and restore configured preferences.
3. Verify POS cash and split tender, refund, stock count/transfer, supplier payment, GL, invoice and duplicate-key handling after enabling the flag in a reversible maintenance test.
4. Record rollback/restoration, audit logs and approval before changing the action switch in production.

**Do not label Phase 1 fully certified or silently enable the global switch without this acceptance.** All existing customer transactions and live subscriptions were left untouched by this release.
