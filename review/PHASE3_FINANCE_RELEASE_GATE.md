# BusinessOS Phase 3 – finance release gate

This GitHub integration intentionally does NOT activate VAT snapshot, usage-limit or accounting migrations.

## What is integrated
- Read-only System Owner subscription payment ledger (no settlement mutations)
- Plan audit and usage-limit diagnostic pages (usage database tables are optional)
- Exact-kobo line-level VAT reference with tests, NOT authoritative checkout logic
- Safe quota-limit error interpretation for user-facing forms

## Production blockers
1. SQL 063/064 live installation remains UNVERIFIED; owner last confirmed SQL 062.
2. Build a disposable PostgreSQL clone with schema through SQL 062, then reconcile 063 and 064.
3. Replace VAT-inclusive POS pricing in *all* authoritative RPCs, including location checkout and split tenders; do not let UI preview diverge from DB.
4. Persist exact line values atomically across order_items, orders, POS VAT evidence and financial snapshots; update invoice and refund/credit-note builders to consume the identical evidence.
5. Test 0.07, 31.17, 1075, fractional quantities, mixed rates, VAT-inclusive discount, refunds and idempotent Paystack settlement.
6. Test concurrency and RLS before activating numerical plan usage enforcement.
7. Verify authenticated role flows and run a complete Next.js build.
8. Do not authorize automatic Supabase migration deployment or mark finance release certified until all gates pass.

## Rollback constraints
Changes to settled sales, tax evidence and credit-note history must not be rolled back with blind schema drops. Plan and rehearse reversal with accounting and DB backup owners.

BusinessOS active deployment is busines-oss; the other busines-os project is intentionally disabled.
