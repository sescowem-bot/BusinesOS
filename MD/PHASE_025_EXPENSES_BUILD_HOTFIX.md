# Phase 025 Vercel hotfix: core expenses type mismatch

## Build failure

At commit `4aa7126`, Vercel reported TypeScript TS2345 in `app/(dashboard)/expenses/actions.ts` and `app/(dashboard)/expenses/page.tsx`: `expenses` was passed to `requireBusinessFeature()`, whose TypeScript parameter deliberately accepts **only premium modules**. The plan catalogue and PostgreSQL `business_has_feature(..., 'expenses')` both classify expenses as a **core** feature.

## Repair

- The Expenses page calls `getWorkspace()` to validate signed-in membership and only displays the recording form to Owner, Manager, and Finance roles. Its query remains restricted to `business_id` and existing RLS.
- The paid-expense server action calls `getWorkspace()`, verifies Owner/Manager/Finance on every request, validates inputs, then invokes the existing `gl_record_paid_expense` RPC. That RPC enforces its own database finance-role and business-membership permissions, preventing client-side bypasses.
- No change to subscription plans, privileged roles, schema, or SQL is needed.

## Installation

1. Extract the hotfix ZIP into the **root of the existing repository**, preserving the two file paths.
2. Keep all other project files and migrations intact. Do not upload the entire project if the GitHub main branch has newer work.
3. Commit both files and let Vercel run `npm run build` again.
4. On the resulting preview, verify that Owner/Manager/Finance can record paid expenses, other business roles cannot submit paid-expense actions, and expenses are only visible within the selected business.
5. Confirm migration `024_accounting_source_integration.sql` is actually installed before testing the paid-expense RPC. This TypeScript fix itself requires **no SQL**.

## Checks performed

- Compared the original affected files with GitHub commit `4aa7126`.
- Scanned source for additional `requireBusinessFeature('expenses')` uses: none remain.
- Updated `scripts/verify-phase25.cjs` to verify the corrected membership/role/RPC pattern instead of expecting the former invalid call. The script now resolves the installed `typescript` package normally rather than relying on an absolute machine path.
- Validated TS/TSX syntax and existing source checks (see release response).
- Full Vercel build and live Supabase testing are still pending; do not claim deployment success from these local checks alone.
