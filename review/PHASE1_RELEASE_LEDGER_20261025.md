# BusinessOS Phase 1 — Production permission hardening (25 October 2026)

## Status — substantial database work installed; final activation/acceptance NOT complete

The following **10 migrations** were reported successful by connected Supabase and verified through read-only system catalog queries:

| Supabase migration version | Migration |
|---|---|
| 20261025173233 | businessos_phase1_payment_action_guard |
| 20261025173310 | businessos_phase1_customer_expense_rls_controls |
| 20261025173333 | businessos_phase1_customer_and_expense_rpc_permissions |
| 20261025173731 | businessos_phase1d_orders_invoices_permission_gate |
| 20261025173818 | businessos_phase1d_pos_refunds_action_guards |
| 20261025173859 | businessos_phase1d_inventory_purchasing_accounting_guards |
| 20261025174013 | businessos_phase1d_core_feature_enforced_in_action_helper |
| 20261025174044 | businessos_phase1d_team_tasks_read_permissions |
| 20261025174221 | businessos_phase1d_staff_approvals_campaign_guards |
| 20261025174405 | businessos_phase1d_direct_rest_role_action_rls |

These migrations:
- Enforce plan/module/action permissions inside CRM customer, payment, order, VAT-reviewed order, invoice, POS (including split tender), return/refund, cashier shift, inventory, catalogue, purchasing, accounting, team and approval procedures, while retaining their existing logic.
- Extend the shared `business_can_perform_action` helper to deny a **disabled core feature** even if global action overrides remain staged; all premium modules still require the subscription entitlement.
- Add six restrictive RLS policies on customer links and expense writes and another 45 restrictive policies on 15 tables (51 Phase 1 policies across 17 tables), preserving existing membership/owner policies.
- Remove general authenticated/anon TRUNCATE, TRIGGER and REFERENCES privileges from customer links and expenses.
- Preserve existing business data; do **not** set pricing, subscription assignments, core toggles or action override records.
- Fix the legacy catalogue owner/admin mismatch so permitted owner/manager/inventory staff may reach its existing validation, subject to plan and role gates.
- Preserve original financial calculation bodies, locking, idempotency and VAT logic in the migrated database procedures.

**Read-only production verification:** 62 of 129 authenticated-callable SECURITY DEFINER functions contain `business_can_perform_action`; 67 are not necessarily unprotected, but include platform admin, lifecycle, support, privacy, login, public access and other routines that have separate authorization and must be assessed individually. The 62 figure is a source-coverage count, **not a security certification**.

All four plans are published, core-grant settings currently show 32 enabled rows (eight modules × four plans), and the inheritance chain is Free → Starter → Growth → Professional.

## Critical release blocker

`public.platform_plan_action_enforcement.enabled` is **FALSE**. The `platform_plan_action_overrides` table has **zero rows**. The backend source checks and premium entitlement checks are applied, but the dynamic **per-role Allow/Deny decisions remain staged** until the global flag is switched on.

**Do not activate the flag just to make an admin screen appear ready.** Before enabling it, require authentic, real-session plan/role acceptance (positive and negative cases), direct REST and direct RPC bypass tests, control of anonymous/public routes, cross-tenant isolation, blocked/removed member behaviour, and payment/stock/refund/journal concurrency/idempotency checks.

We did **not** perform those tests in this session and therefore do NOT claim Phase 1 is finally signed off.

## Production SQL ledger

The SQL files below are snapshots of **already applied SQL**. They must not be rerun on live production. Historical original migration IDs live in Supabase migration history:
- `review/sql/20261025_phase1_applied_core_procedures_SNAPSHOT.sql` — current CRM, payment and expense procedure definitions.
- `review/sql/20261025_phase1d_orders_invoices_APPLIED.sql`
- `review/sql/20261025_phase1d_pos_refunds_APPLIED.sql`
- `review/sql/20261025_phase1d_inventory_purchasing_accounting_APPLIED.sql`
- `review/sql/20261025_phase1d_core_feature_action_helper_APPLIED.sql`
- `review/sql/20261025_phase1d_team_tasks_reports_APPLIED.sql`
- `review/sql/20261025_phase1d_staff_approvals_campaign_APPLIED.sql`
- `review/sql/20261025_phase1d_direct_rest_RLS_APPLIED.sql`

The older `review/sql/20261025_phase1b_core_rpc_rls_REVIEW_ONLY.sql` is **superseded and must NOT be executed**. The published schema contains replacement protections with other, verified migration IDs.

## Unfinished acceptance checks

1. Run the read-only `review/sql/20261025_phase1_final_READ_ONLY.sql` after deployment and compare counts. Source-level tests run in CI, not against real authenticated tenants.
2. Test Free, Starter, Growth and Professional across Owner, Manager, Finance, Sales, Inventory and Staff; test all six actions for each of the 19 modules, inherited roles and disabled paid modules. Test an admin Deny, revert it and verify audit history, including from raw REST and RPC calls.
3. Test owner/account recovery paths and platform admin actions even if a customer subscription expires or is suspended; permit only the intentionally documented exceptions.
4. Verify direct financial transactions and compound writers, including sales-to-GL, POS split tender, refunds, inventory quantity corrections, source event retries, and duplicate payment keys.
5. Inspect the 67 remaining callable privileged procedures and any other writable public Data API tables, distinguishing public/user-managed workflows from module actions. A missing action check on an intentionally unaffiliated public function can be legitimate, but a write bypass is not.
6. Have a recoverable backup and rollback drill before changing the action flag; record approval, version, test evidence and support ownership.

The old Phase 1B migration proposal is not a substitute for the above applied migrations and should never be pasted into production.

## Other outstanding project phases (outside this security phase)

VAT/POS/refund permanent accounting fixes; numerical plan usage limits; controlled Paystack end-to-end acceptance; complete Free-plan commercial defaults; measured latency improvements; operational legal/privacy/compliance work.
