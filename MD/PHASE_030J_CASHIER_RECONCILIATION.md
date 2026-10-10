# Phase 030J — Cashier Management & Daily Reconciliation

## Installation order and scope

This release continues the **Order + Initial Payment UX** release (migration 036) and adds **migration 037**, `037_pos_cashier_shifts_reconciliation.sql`. Apply 037 **once only**, after 036, in a staging clone of the real schema. Do not reset the database or rerun earlier migrations. Confirm a clean CI/Vercel Preview build and pass `MD/PHASE_030J_ACCEPTANCE.md` before production rollout.

This release is limited to businesses configured in **NGN**. It does **not** process bank/card payments, connect to card terminals, create accounting journals, reconcile external bank feeds or submit VAT. It does not modify existing payment, order, stock, invoice or return amounts. Existing POS sales are not backfilled into historical shifts.

## Pages

- `/pos/shifts`: cashier shift register, personal opening controls, daily management summary and cash capture exceptions.
- `/pos/shifts/[id]`: opening balance, captured cash, manual vouchers, expected cash, physical count, variance and management review.
- `/pos`: retains checkout and now links to the cashier centre.

## Cashier sequence

1. Owner, manager or sales role with **POS entitlement** opens their own till. One open shift per cashier and business is permitted.
2. New POS sales automatically bind to the cash register of the cashier who entered them when an open shift exists. **Only completed cash payments** are captured as physical cash. Transfers, external POS, cards and unpaid sales are excluded.
3. Subsequent completed cash payments on an existing POS order are captured if the user posting that payment has an open shift. Captures include a unique payment ID and original amount; future changes to the payment are reported as exceptions.
4. Cashier records non-sale **cash-in** or **cash-out** movements with a unique voucher number and explanatory reason. Cash refunds documented in Returns are **not automatically withdrawn** from the physical till calculation: the actor must record a cash-out, referencing the same external refund voucher and the exact amount. The exception counter reveals unmatched cash refunds.
5. Cashier physically counts the till and closes their own shift. The database freezes expected cash, counted cash and variance in one transaction; it rejects invalid or negative theoretical balances. Cash-in and cash-out cannot be changed later via normal app roles.
6. Owner or manager reviews a closed shift, records notes and accepts its recorded results or flags the shift for investigation. A manager cannot approve their own shift; an owner may review their own shift when operating a sole-owner business. Acceptance does not erase variances.

**Formula:** Closing expected cash = opening cash + captured POS cash receipts + manual cash-in − manual cash-out. Variance = counted physical cash − expected cash.

## Management control and limitations

- Daily report groups shifts by **opening date in Africa/Lagos time**, not closing date. Overnight shifts belong to the day they opened. The report includes closed-shift cash receipts and variance only; open shift amounts are not treated as final.
- Full totals are computed by database aggregate functions, **not** from the first 50 displayed shifts or first 100 displayed audit records.
- Read-only control exception counters identify POS sales created without shifts, completed cash payments not linked to any shift, captured payment records changed later, and cash refunds without matching cash-out voucher + amount. Matching a voucher is indicative evidence, not independent proof of physical cash payment.
- Shift cash balances are **not equivalent to net sales, cash flow, bank reconciliation or general ledger balances**. Refunds and credit notes remain excluded from the accounting bridge pending a separate approved design.
- Do not operate POS tills for commercial users before staging confirms multi-cashier concurrency, refunds, payment-posting timing, subscription/RLS access and mobile behaviour.
- All writes require authenticated, database-guarded RPCs; raw table insert/update/delete is revoked from app users. Receipt capture functions run as secure trigger functions.

## Free-first architecture

Uses the existing Next.js app and PostgreSQL triggers/functions under Supabase. No mandatory paid API, new SaaS provider or POS hardware is required. Free-tier limits still apply.

## How to run source checks

```bash
npm run check:routes
npm run check:phase30j
npm run check:order-payment
npm run check:phase30i
npm run typecheck
npm run build
```

Then run `MD/VERIFY_SQL_037_READ_ONLY.sql` after applying the migration. All items should exist and the new tables must have RLS enabled. This checker does **not** verify live execution; use separate cashier test accounts and the 30-case checklist.

## Compatibility and release status

The current package includes every prior source file and migration through SQL 037. Merge to a review branch and test all earlier critical features. No live database deployment or build acceptance is implied by source-level checks alone. Do not advertise the module as audited, certified or production-ready until all staging checks pass.
