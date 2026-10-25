# BusinessOS Phase 1G — Live action permissions activated

**Release date:** 25 October 2026 · Production Supabase project verified through connector.

## Outcome

The per-plan/per-staff-role **action enforcement switch is now ENABLED**. This completes the technical enablement of the 19-module × 6-action permission matrix. Existing business assignments, active entitlements and staff roles were preserved.

Current live baseline after activation:
- `platform_plan_action_enforcement.enabled = true`
- **0** saved action overrides; all actions inherit previously installed core and paid module eligibility plus existing role restrictions until configured.
- **6** business memberships, all **Owner**; no test users permanently created.
- All four published plans retain eight enabled core module settings (32 enabled grants).
- Phase 1/1D/1E restrictive policies: **70** across 24 tables.
- The SQL patch to `admin_save_plan_action_matrix` rejects premium **Allow** preferences for Free at the database layer as well as in the UI.

## Live migration ledger — already executed, DO NOT RERUN

| Database migration | Result |
|---|---|
| `20261025215446_businessos_phase1g_harden_audited_matrix_saving` | Applied successfully; rejects Free premium Allows inside audited administration RPC |
| `20261025215511_businessos_phase1g_activate_action_matrix_after_parity` | Applied successfully; controlled switch activation with preconditions |

The exact applied SQL was retrieved from `supabase_migrations.schema_migrations` and archived under `review/sql` as `*_APPLIED_DO_NOT_RERUN.sql`.

## Acceptance evidence obtained

1. **Four-plan Owner inheritance regression** using an explicit rolled-back SQL transaction: setting a Deny on Free propagated through Starter, Growth and Professional. A closer Growth Allow and Professional Deny won in the correct order. An Allow on Free POS never bypassed missing Free premium entitlement. Owner settings View stayed available.
2. **Twenty-four simulated plan-role combinations:** each of four existing plan-assigned Owner memberships was temporarily set to Owner, Manager, Finance, Sales, Inventory and Staff **inside a transaction that explicitly rolled back**. Verified Sales module View inheritance, unaffected other roles, settings and dashboard accessibility, Free POS denial, and consistency with `business_visible_modules`.
3. **2,736 before/after permission parity comparisons** (`4 plans × 6 roles × 19 modules × 6 actions`) with no persisted overrides. Enforcement ON produced **identical** responses to OFF for all combinations inside a rolled-back transaction. This was the activation precondition.
4. **Actual audited System Owner save RPC tested in rollback-only transaction:** saving Free / Sales / Orders / View = Deny produced one temporary override and an audit entry, immediately denied the action and removed Orders from `business_visible_modules`; clearing to Inherit removed the override and produced a second audit entry, restoring access. The Free-plan premium-allow attempt was rejected by the database as intended.
5. **Cross-tenant read-only query under PostgreSQL role authenticated:** simulated valid JWT claims; direct selection of another business's customer links, expenses, orders and payments returned zero rows, and cross-business `business_can_perform_action` and `business_visible_modules` denied access.
6. **Final production verification:** switch remains ON; zero overrides and zero audit entries from rollback tests; all six Owner memberships retained. No customer, payment, plan assignment or financial record was modified by the acceptance tests.

## Frontend and administrator experience

The 24 guarded route layouts, request-cached module visibility resolver, sidebar and mobile filtering were deployed in Phase 1F. The System Owner Action Permissions UI now explains that saved choices **apply immediately** when enabled, with a reminder that Allow does not bypass tenant membership, plan entitlements or baseline staff restrictions. The administrator may select Free/Starter/Growth/Professional, pick any of the six staff roles and edit all 114 action decisions with a required audit reason.

## Remaining quality assurance (not claimed complete)

This validates database logic through privileged SQL and simulated JWT claims, **not real browser sessions for five non-Owner roles**. The production dataset has no Manager, Finance, Sales, Inventory or Staff memberships. Before declaring full end-to-end operational sign-off, perform authenticated UI and direct PostgREST/RPC acceptance with designated staff test accounts, plus positive payment, POS split tender, refund, stock, invoice and accounting flow checks. Also confirm onboarding, cookie session renewal and live subscription switching in real browsers. No external Paystack charge or refund was attempted in these tests.

**No new Supabase project/branch was created, and no extra Vercel deployments were triggered except the single consolidated GitHub release for frontend/docs.**

## Emergency response and rollback

If a permission update unexpectedly blocks legitimate live work, first restore the specific Plan / Role / Module / Action in System Owner → Action-level permissions to Inherit, using an audited reason. In a serious incident, the database enforcement flag can be set to false by an authorized operator as a controlled rollback; this returns to the previous module-entitlement and legacy-role behavior. Do **not** delete policies or rerun older `APPLIED` migrations to roll back. Record incident details and test before re-enabling.

### Verification

Run the **read-only** checks in `review/sql/20261025_phase1g_after_activation_READ_ONLY.sql` or inspect the System Owner permission page. Any live issues should be assessed against the logged-in user's plan, role, business membership, active core settings and inherited overrides.
