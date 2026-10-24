# BusinessOS System Owner action permissions – staged security release

## Current status
The SQL candidate is deliberately located under `review/sql/`, **not** under `supabase/migrations/`. No live user permission changes are authorized by this document.

The action-matrix editor covers six verbs (view/create/edit/delete/approve/export) for 19 core and premium modules and six named roles. Current database entitlements, hardcoded server role checks and RLS remain authoritative until the rollout is tested.

The System Owner may store audited preferences **after** staging review, but a saved `allow` never makes a Free premium module available or grants a customer access to another business. An explicit `deny` becomes effective only once its enforcement path is tested.

## Staging setup (not production)
1. Build a disposable database from the exact current BusinessOS schema and confirm SQL 062–064, tenant constraints and role enum values.
2. Run `review/sql/phase3_action_permission_readiness_READ_ONLY.sql`.
3. Apply the reviewed `phase3_plan_action_permissions_STAGING_ONLY.sql` in that disposable environment only. Inspect RLS, public grants, role checks, function security and audit data.
4. Test: unauthenticated and non-System-Owner RPC calls rejected; unknown plans/modules/actions rejected; duplicate and incomplete matrix rejected; Free premium allow rejected; no-op saves create no audit; changed decisions always produce audit reasons; invalid 12–300-character reasons rejected.
5. Confirm concurrent System Owners cannot lose audit history or clobber later decisions without a detected conflict.
6. For each action below, implement and test **non-elevating** enforcement in the authoritative RPC and RLS policies. Do not rely on UI guards or manually edited JWT user_metadata.

## Database enforcement inventory (NOT COMPLETE)
| Action | Authoritative path identified | Status |
|---|---|---|
| Create customer | `crm_create_customer` | Needs action-based authorization guard |
| Create order | `crm_create_order_with_cost` | Needs action guard and idempotency verification |
| Record payment | `crm_record_payment` | Needs action guard; payment totals must reconcile |
| Module read | Per-table RLS and read RPCs | Review per table |
| Product and stock changes | Catalogue and inventory RPCs | Review all mutating RPC variants |
| POS checkout | All POS checkout and split-tender RPC variants | Financial/VAT acceptance unresolved |
| Refund/return | Return and credit-note RPCs | Reconciliation unresolved |
| Plan activation | Paystack-verified subscription activation | Must remain payment-only |
| Plan matrix edits | `admin_save_plan_action_matrix` (staging) | System Owner only, 12–300-character audit reason |

## Non-elevation rule
A request may proceed **only when all conditions hold**: authenticated user, membership in exact business, valid current subscription and features, existing role/tenant/RLS authorization, and no applicable action-level denial. New `allow` preferences cannot bypass any earlier check. Deny must win across applicable role/business/profile layers.

## Production blockers
- Disposable PostgreSQL tests and security advisors
- All live mutation and read entrypoints inventoried and guarded
- Negative tests for cross-business and Free premium access
- End-to-end role matrix effective-permission tests
- SQL 063–064 status reconciliation
- VAT-inclusive accounting correction and refunds
- Paystack test event and idempotency verification
- Rollback and observability plan for actual database changes

Until the above are done, **do not activate staged action permissions in production**.
