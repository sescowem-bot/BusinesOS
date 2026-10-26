# BusinessOS Phase 2A–2B — POS, VAT, commercial invoices and refunds

**26 October 2026 · Live production database migration / UI release**

## Implemented and applied to production

Three confirmed database migrations (archived under `review/sql/*_APPLIED_DO_NOT_RERUN.sql`). Do **not** replay them:

1. `20261026062759_businessos_phase2a_pos_refund_gl_event_capture_and_posting`: extends permitted accounting source types to `pos_sale` and `refund`, adds after-insert source-event capture to `business_pos_sales` and `business_pos_refunds`, and updates five existing ledger routines in place. It does not alter previous posted journals.
2. `20261026063039_businessos_phase2b_pos_tax_refund_readonly_financial_health`: protected, read-only `business_pos_accounting_health(uuid)` summarises sale/refund source coverage, VAT mismatches, duplicative POS-invoice source events, inconsistent refunds, unbalanced POS journals and unposted POS/refund events.
3. `20261026063321_businessos_phase2b_invoice_specific_capture_safe_branch`: safely isolates the invoice-specific `NEW.order_id` check inside the invoice branch of the shared capture trigger.

## Accounting behavior

- **Ordinary commercial invoice:** keeps existing accrual. Debit receivables for total; credit sales (net after discount), delivery income and recorded VAT. Previously received customer advances are offset only once.
- **POS checkout (with or without commercial invoice):** captures a distinct `pos_sale` source event. On posting, debit receivables for gross sale and credit sales revenue, delivery and VAT separately. Where the cash payment was posted earlier as a customer advance, offset that advance against the POS receivable.
- **Payments after POS sale:** credit receivables rather than customer advances if the POS sale has already been journalized. Split-tender and delayed customer receipts use the same payment source record pathway.
- **POS invoice issued later:** still generates the ordinary customer-facing invoice snapshot, VAT identity and tax-line evidence, but deliberately does **not** enqueue a second income journal. Historical source discovery excludes POS invoice events.
- **Approved, externally confirmed refund:** creates a `refund` event from the immutable refund and return records. When the underlying POS sale is already posted, debit sales returns (via sales-income account), debit output VAT for the recorded VAT credit, and credit cash/bank for the refund amount. Net + VAT must reconcile exactly to the confirmed refund. Partial credits remain separate and auditable.
- **Unposted POS before refund:** the refund event remains pending/error for review; it must not reverse unrecognized revenue. Use the controlled accounting queue after the original sale posts. A refund confirmation is only a record of an already-executed external refund: the app does not initiate a bank or card payout.
- **Accounting setup:** existing GL account mappings become immutable after journals from invoice, payment, expense, POS sale or refund exist. Existing manual journals and opening balances still require independent review.

The transaction source event uniqueness key (business + source type + source ID) and original journal de-duplication logic are preserved. The original POS and return RPC signatures and VAT allocation are unchanged.

## Review and visibility in product

- Accounting → General Ledger shows a **POS, VAT & refund integrity** summary using the protected database function.
- It highlights missing events, VAT/refund discrepancies, an attempted second invoice posting, unbalanced journals and unposted sales/refunds.
- Account setup descriptions and source-discovery copy explain all five recognized source types.
- Counts are **structural checks**, not assurance of accurate cash, tax liability, inventory valuation, timing or a balanced complete financial statement. Errors need attention before posting or exporting reports.

## Production verification and real-world limits

Read-only introspection verified:
- Both new `AFTER INSERT` capture triggers are installed.
- `gl_source_events.source_type` accepts exactly invoice, payment, expense, pos_sale, refund.
- All five updated ledger routines contain the POS/refund support.
- An authenticated Professional Owner can invoke `business_pos_accounting_health` and sees a zero-issue baseline.
- Existing data at the migration time: **0 POS sales, 0 POS refunds, 0 integration settings, 0 general-ledger journals; 4 existing invoices and 11 queued invoice/payment/expense source events**.
- No production payment, invoice, stock, refund, subscription or bank transaction was inserted, updated or deleted by these migrations.

**Not yet verified:** a real POS checkout/refund through configured chart of accounts and open period (the production project has no active GL integrations and no live POS data), split tender/partial refunds over multiple periods, accounting period exceptions, ledger COGS/inventory valuation, and formal VAT/legal filing treatment. Do not say these have passed financial end-to-end acceptance. Phase 2 transaction integration and operations require a controlled accountant-approved pilot.

## Operational procedure

1. Configure valid separate cash, receivable, customer advance, income, tax, delivery and expense accounts and an open period **only after professional review**.
2. Issue a controlled POS transaction in the desired business through the normal app, verify `pos_sale` event, full double entry and VAT tax-line reconciliation.
3. Verify the receipt posts against receivable or customer advance as appropriate; issue an invoice and check no duplicate income event.
4. Approve and record an externally completed refund; check the credit note, returned stock status, refund event and the balanced revenue/VAT reversal.
5. Confirm finance health summary and all source-event errors. Do not blindly bulk-post old financial records: past manual GL postings and opening balances can overlap.

### Security and rollback

Read-only diagnostic requires an active tenant membership, Owner/Manager/Finance role, active Accounting entitlement and Accounting:View action. It rejects anonymous access. If the new event path fails, pause the integration using Accounting settings, preserve source events and investigate; do not erase posted journals or rerun applied migrations. Database rollback requires a reviewed replacement migration and accounting oversight because reversing recorded journals is a financial correction, not a code revert.
