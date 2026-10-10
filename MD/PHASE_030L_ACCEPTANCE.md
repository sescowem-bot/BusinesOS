# Phase 030L staging acceptance tests

Record PASS/FAIL, staff role, business ID (redact customer details), test order IDs and transaction evidence. Test on a staging database, never live customer payments.

## Catalogue and checkout

- [ ] Enter an exact SKU and press Enter: one unit added. Scanner keyboard input also triggers Enter without submitting checkout.
- [ ] Unknown SKU: user-visible error; no stock or payments changed.
- [ ] Repeated SKU increases basket quantity up to available location stock.
- [ ] Increment/decrement quantities; items at zero disappear; stock-limit guard holds.
- [ ] SKU scan cannot find unloaded items beyond 500; warning accurately describes this limit.
- [ ] Confirm VAT-exclusive and approved VAT-inclusive prices match SQL and printed invoice, including discounts.

## Held carts

- [ ] Cashier A holds basket at Branch A; reloads; resumes with correct customer, quantities, price mode and discount.
- [ ] Cart remains visible only to cashier A; cashier B in same company cannot read/modify/delete it.
- [ ] Cashier from Business B cannot access Company A's cart via direct RPC.
- [ ] Sales staff cannot create a cart in a branch to which they are not assigned.
- [ ] Non-POS user cannot save, delete, read or resume cart via RPC.
- [ ] Cart storage does not reserve stock; another sale that depletes stock causes resumed checkout to fail.
- [ ] Price updates between hold and resume are reflected by the final database checkout calculation.
- [ ] 21st held cart rejected; discard then new cart works.
- [ ] Direct authenticated INSERT/UPDATE/DELETE of held carts denied by database privileges.

## Split recorded payments

- [ ] Two tenders adding to exact POS total save two completed payment records, with method and reference.
- [ ] Three recorded tenders save within same sale; cashier shift captures only cash components.
- [ ] Partial total creates outstanding balance and correct order status; later payment can settle it through existing route.
- [ ] Sum above server-computed VAT-inclusive total rejects *entire checkout*; no stock depletion or payments.
- [ ] Zero, negative, >2 decimal places, unsupported method and >3 tenders are rejected.
- [ ] Attempt to bypass VAT review via split RPC on registered-but-unreviewed business fails.
- [ ] Direct legacy POS checkout for a VAT-registered company cannot insert a sale without reviewed tax evidence.
- [ ] Repeated checkout request ID and identical payload returns same order and unchanged payment count.
- [ ] Reused checkout request ID with changed basket, tenders, location or amount fails.
- [ ] Two parallel attempts with identical key result in exactly one POS sale and set of payments.
- [ ] Unauthorised role or another business's stock location fails before any sale occurs.
- [ ] Existing one-method paid and unpaid POS checkout still work unchanged.

## Receipt and production readiness

- [ ] POS summary displays business identity, selected location, order items, amounts received and outstanding balance.
- [ ] POS summary prints legibly at A4 and narrow mobile, including two or three payment methods.
- [ ] Another business cannot open or print someone else's POS receipt, even with a known order UUID.
- [ ] Printed POS summary does not imply automatic bank/card settlement or tax-authority validation.
- [ ] Confirm branch stock aggregate reconciles to products.stock_quantity after normal and split sales.
- [ ] Confirm `npm run typecheck` and `npm run build` pass in GitHub Actions/Vercel Preview.
- [ ] Confirm the SQL 040 checker shows the new tables and VAT guard with RLS and no direct authenticated writes.
