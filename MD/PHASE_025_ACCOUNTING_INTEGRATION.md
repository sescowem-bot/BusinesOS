# Phase 025 — Accounting Integration

## Scope

This release adds a controlled, optional bridge between issued commercial invoices, completed customer payments, paid expenses, and the existing double-entry general ledger. Migration `024_accounting_source_integration.sql` creates a tenant-isolated integration configuration and durable source-event queue. New source events are captured at the database boundary and, **only when integration is enabled, account mappings are valid, an open period exists, and the business has accounting entitlement**, the bridge attempts to post balanced journals. Posting failures are recorded in the queue without blocking the original sale, receipt, or expense.

An issued invoice debits trade receivables and credits sales, delivery income, and recorded tax liability. A receipt debits cash and credits receivables if the invoice journal already exists, otherwise customer advances. When the invoice journal is subsequently issued, previously recorded customer advances on that order are reclassified against receivables, avoiding recognising the payment as revenue twice. A paid expense debits the mapped expense account and credits cash. No cost of goods sold, stock valuation, payroll, supplier payables, refund/reversal, or tax filing treatment is assumed. These are future work and require an accountant's review.

## Installation prerequisites

* The database has run migrations **001 through 023**, in order. Migration 024 is additive and must run once, in staging first. Run it after backing up the database.
* Deploy this source code to **Vercel Preview** before promoting to production.
* Confirm the appropriate subscription plan grants `accounting`, and grant the team member the relevant role. Other business members can still record their operational transactions as previously allowed.
* Do **not** re-run older migrations or drop any tables.

## Enabling financial posting

1. Open `/accounting`, create the chart of accounts you need (cash/bank asset, receivables asset, advances liability, sales income, delivery income, recorded tax liability, operating expenses) and create an **open** accounting period covering the transaction dates. Validate opening balances with an accountant.
2. In *Connect operational transactions*, select the correct business-specific GL accounts. Activation is **opt-in**, and defaults to **Paused**.
3. Check the accounting-policy confirmation box and change automatic journal posting to **Enabled for new transactions**. Invoice recognition is at invoice issue, not order creation. It may not match every business's accounting policy.
4. Issue one test commercial invoice, record a partial customer payment and a paid expense. Confirm all three source events are `posted`, inspect each journal and reconcile the balanced trial balance.
5. For existing source transactions, use **Find existing transactions** first and carefully check for corresponding *manual journals* to avoid double counting. Use **Post next 20 pending entries** only after review. Legacy posting is never automatic.
6. Investigate errors such as **No open accounting period**, correct setup, then rerun the queue. DO NOT manually delete posted journals.

## Security and correctness

* Source-event tables allow **finance-scoped SELECT only**; no direct client mutation is granted.
* Mutations are database RPCs with finance-role / business-plan verification, except the core paid-expense function, which remains available to authorised finance roles across plans.
* Journal writing is `SECURITY DEFINER` internal code not executable directly by clients. Every financial event includes a business ID and uses the tenant's own configured accounts.
* Existing unique `(business_id,source_type,source_id)` rules prevent double-posting through retries; the queue locks event rows.
* Previously posted journals are unchanged by disabling the integration. Mapping changes after any source journal are refused.
* A downgrade to a plan without accounting access stops new automatic postings; existing posted journals remain.
* There is no automatic financial statement certification. Exports are only as complete as their posted data.

## Current limitations / future work

* No refund, credit-note, void/reversal workflow for source events (must not delete booked records).
* No automatic COGS/inventory valuation; this release uses the cost-neutral sales snapshot.
* No full statutory tax computation or confirmed Nigerian tax treatment.
* No auto backfill of historical events; manual GL entries representing those events cannot be identified automatically.
* Ledger monetary precision is two decimal places; validate rounding and delivery allocations in staging.
* No external payment gateway integration, by design.
* There is no proof of a successful production build or live Supabase integration in the delivered source package. Validate in Vercel Preview and your staging database.

## Acceptance scenarios

1. Member without finance role cannot configure accounting or create paid expenses.
2. Premium accounting feature disabled: configuring and posting queues are denied; creating a paid expense still works for a finance user.
3. Two distinct businesses cannot read or post each other's ledger/queue.
4. Invoice before payment: invoice Dr A/R / Cr revenue; payment Dr cash / Cr A/R.
5. Payment before invoice: payment Dr cash / Cr customer advances; invoice Dr A/R, Cr revenue, Dr advances, Cr A/R.
6. Missing GL mapping or closed period: source transaction survives and queue records an error.
7. Repeated queue processing: only one source journal is present.
8. Existing manually posted items are reconciled before historical queue processing.
9. Auto-posting paused: new events remain pending until authorised posting is enabled.
10. Upgrade / downgrade accounting access must never expose another tenant's records.
