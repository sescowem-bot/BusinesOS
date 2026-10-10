# BusinessOS Phase 030L — Premium POS Completion (bounded release)

## Purpose
Fast barcode/SKU checkout, cashier-scoped held baskets, recorded split payments and branded printable POS summaries. All code extends the latest Phase 030K-B (SQL 039) source. No mandatory paid API or external hardware required.

## Implemented

- Scanner-style **SKU/barcode field**: keyboard-wedge scanner or typed SKU followed by Enter. The product's SKU must contain its barcode. Search covers the existing 500 loaded active products; this is **not** camera scanning, server-side catalogue pagination or hardware payment-terminal integration.
- Quantity increment/decrement controls respecting loaded location stock estimates. Server is authoritative.
- Cashier-owned held carts, up to 20 per cashier; hold, resume and discard. Stored in Supabase and scoped to the cashier and business, including conflict-safe ownership checks for concurrent cart updates. Holding does not reserve inventory, lock prices, approve tax or promise availability.
- Two- or three-tender checkout (`cash`, `transfer`, external `pos` or `card`, `other`). **Only staff-confirmed, already received payments** are recorded. Full and partial receipts are supported. New split checkout RPC first creates the reviewed/location-aware order and then creates payments in the *same database transaction*. Any rejected tender rolls back the sale, payments and stock.
- Server-bound transaction token, advisory transaction lock and stored request fingerprint reject replay with changed details. Existing single-payment checkout remains supported.
- New POS summary `/pos/receipts/[id]` with business identity/logo, item lines, total, payment breakdown, outstanding balance and print support. This is not a tax-authority-validated electronic receipt, tax invoice or proof of external settlement.
- VAT guard prevents **new registered-VAT POS sales** without reviewed item evidence even if a caller directly invokes a legacy checkout RPC.

## Migration and deployment

1. Confirm the project contains all releases through 030K-B and migrations **001–039**, and SQL 039 stock reconciliation has passed in a **staging copy**.
2. Create a database backup. Apply `supabase/migrations/040_premium_pos_held_carts_split_tenders.sql` **once** in staging. It is not an idempotent reinstall script.
3. Run `MD/VERIFY_SQL_040_READ_ONLY.sql`, confirm both RLS-enabled tables deny direct authenticated INSERT/UPDATE and the VAT guard trigger is installed.
4. Deploy the matching source to Vercel Preview, verify role permissions, previous 030H–030K transaction flows and new 030L cases in `MD/PHASE_030L_ACCEPTANCE.md`.
5. Review operational staff procedures: payments must be externally confirmed, hold carts must be cleaned up, and cashier shift reconciliation must match cash tender recordings.
6. Only after Preview build **and** live Supabase integration tests pass, consider a production deployment.

**Important:** This SQL modifies no historical orders, invoices or payments. It installs additive tables, RPCs and a BEFORE INSERT guard on new POS sales. No invoice/VAT return reporting integration is added.

## Limitations

- Barcode lookup uses the current **500-product** loaded catalogue. A large-store rollout needs server-side search, pagination, and optional camera scanning.
- Single-tender mode continues to mean already paid in full or unpaid; split mode can record a partial or fully paid sale with 2–3 tenders. Separate later payments use the existing order workflow.
- Held carts are private to the cashier, not sharable queues or reservations.
- POS summaries dynamically read saved payment records and should not be confused with immutable numbered invoices or NRS-validated documents.
- No live database or Vercel production build was performed by this source-only release.
- Critical follow-on: cash/tender settlement import, full returns accounting, branch stock concurrency tests and high-volume catalogue search.
