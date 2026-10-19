# Plan inheritance SQLSTATE 42703 — safe release procedure

Observed on BusinessOS System Owner > Pricing Plans > Save plan inheritance.
PostgreSQL SQLSTATE 42703 means an undefined column.
This is a backend schema/function/trigger mismatch, not a pricing publishing failure.
The screenshot does not expose the specific missing column name: the old UI hides it.

## Diagnose first (read only)
1. Supabase SQL Editor: run MD/PLAN_INHERITANCE_42703_READ_ONLY.sql.
2. Check plan_parent_links columns plan_id, parent_plan_id, updated_by, updated_at.
3. Check platform_subscription_audit fields and log_subscription_parent_changes trigger.
4. Compare the actual function definitions with original SQL 029 and 053 if needed.

## Repair
- Back up database; stage the migration in a test environment if possible.
- Apply supabase/migrations/055_plan_inheritance_column_repair.sql only when the required parent and audit tables exist. It includes a transaction and stops if core columns are missing.
- It adds ONLY absent updated_by or updated_at metadata to plan_parent_links, recreates the administrator-only relationship RPC, and refreshes the audit trigger body without dropping existing relationships.
- It does NOT change plan prices, publication status, business subscriptions, paid periods, customer data, existing links, or feature rules.
- It preserves checks for valid plan parents, circular links and active System Owner status.

## Verify
1. Refresh /admin/plans, select a plan (e.g. Growth), choose a different parent (e.g. Starter), and Save.
2. Verify a success message and inspect the new parent and inherited feature availability.
3. Verify selecting Independent plan removes ONLY that plan's link, not any price or subscription record.
4. Run: SELECT plan_id,parent_plan_id,updated_at FROM public.plan_parent_links ORDER BY plan_id;
5. Confirm circular plan links are rejected and audit history is recorded.
6. If 42703 persists, capture the exact missing-column message surfaced to the System Owner; check other custom triggers or functions before further changes.

## Code and deployment
- app/admin/plans/parent-actions.ts shows the database's relevant missing-column error only to a System Owner, and logs message/details/hint to server logs.
- app/admin/plans/parent-form.tsx avoids displaying an outdated error when choosing a different option.
- SQL 055 applies as soon as it is run in Supabase; improved UI messaging needs a new Vercel deployment.
- Supabase SQL Editor calls do not have the web user's authentication context. Validate actions through the app.
