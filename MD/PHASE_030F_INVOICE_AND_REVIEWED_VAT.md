# BusinessOS Phase 030F — Professional Invoices and Reviewed VAT

## What this release changes

- Redesigned mobile / A4 print invoice with seller identity, TIN/RC where supplied, buyer, order, readable items, tax classification, discount, delivery, payment at issue, outstanding at issue, bank and footer.
- Branding settings at `/settings/invoice` available to business owners only. Settings are frozen into the **new** invoice snapshot when issued; **historical invoices are never changed**.
- Reviewed-tax order creation at `/orders/new`, separate from the older general order entry. It requires `business_tax_profiles.classification_status='reviewed'`, `vat_registration_status='registered'`, and **one** effective, approved VAT rule for a registered supply. The database—not a client-supplied rate—calculates tax.
- Standard 7.5% VAT on *VAT-exclusive* net line value after discount; zero-rated 0%, exempt and outside-scope are distinguished. All calculations are stored at order creation with the approved rule version and tax date. The existing invoice issuer picks that up at issuance.
- The ordinary `crm_create_order` RPC blocks new zero-VAT orders after a business becomes approved as VAT-registered and reviewed, rather than letting the ordinary manual form silently bypass tax review. The separate POS function is not yet covered.
- Delivery charges deliberately unavailable in the reviewed-tax flow until separately classifiable. No hidden tax assumptions. General orders/older POS workflows remain as before and MUST NOT be represented as tax-validated.
- `business_order_tax_reviews` is tenant-readable but only writable from the validated, SECURITY DEFINER order RPC; ordinary clients cannot inject tax evidence.

## Install after SQL 031

1. Back up the database and deploy to an isolated staging Supabase project.
2. Apply `supabase/migrations/032_invoice_identity_reviewed_vat.sql` ONCE. This migration adds two tables, one RPC and a BEFORE INSERT invoice trigger. It neither backfills nor edits old invoices.
3. Deploy source to Vercel Preview and check CI route audit and full `npm run typecheck` and `npm run build`.
4. From the business settings, open `/settings/invoice`, configure and save branding and payment info.
5. Use a **test** business with a verified VAT profile, an approved `tax_rule_versions` standard/zero/exempt rule, and **exactly one** approved `business_tax_assignments` record for a supply. Classifications are set through your trusted tax review process; this release **does not create or approve legal rules automatically**.
6. Create a *reviewed-tax* order, inspect the order's VAT calculation and the row in `business_order_tax_reviews`. Issue a commercial invoice and print to A4 or mobile PDF. It should show `VAT (7.5%)`, `VAT (0%, zero-rated)`, `VAT exempt` or `Outside VAT scope` correctly.
7. Verify an old invoice still has the same frozen total and shows `Tax recorded (unverified)` where no reviewed tax evidence exists.
8. Test tenant isolation, role restrictions, invalid/multiple/expired tax rules, duplicate submissions and discount rounding.

## Example only

For a verified business and an **approved** standard-rate supply:

- Item: ₦5,000 (VAT-exclusive), quantity 1, discount ₦200, delivery ₦0
- Net base ₦4,800; VAT at 7.5% = ₦360; **new order total ₦5,160**.
- For an otherwise identical approved zero-rated item, VAT is ₦0 and total ₦4,800.
- A legacy invoice with ₦5,000 total in the screenshot remains ₦5,000 because issuance is immutable; no retrospective VAT assessment is made.

## Legislation and important limitations

Primary reference: Nigeria Tax Act 2025, s147 standard VAT of 7.5%, s152 VAT invoice contents, s185 exempt supplies, s186 zero-rated supplies: https://nass.gov.ng/documents/download/11249

See also Nigeria Tax Administration Act 2025 for small-business relief and VAT obligations: https://www.nrs.gov.ng/uploads/NIGERIA_TAX_ADMINISTRATION_ACT_2025_8c945071a7.pdf

**The business must verify its own eligibility and applicable law with a qualified tax professional.** Registration self-report alone does not prove VAT liability. Small-business relief, opt-ins, special categories, VAT-inclusive prices, mixed-rate orders, ancillary costs, exports, tax point adjustments and future law changes need more work.

This does **not** certify an NRS statutory electronic invoice or register IRNs/QR codes. The NRS system uses a separately validated structured format: https://einvoice.nrs.gov.ng/docs/system-integrator/invoice-schema . Do not represent a browser-generated printable invoice as a validated e-invoice.

**POS remains an important gap**: Phase 030E's POS checkout is not yet integrated into this new reviewed-tax path. Do not present all POS sales as VAT compliant. A future integration must apply approved item-level VAT within the POS database transaction, including mixed baskets, discounts, returns and delivery charges. Historical statements likewise remain unchanged.

## Production acceptance blockers

- Full Next.js typecheck/build in CI, plus verified staging application with migrations 001–032
- Trusted tax rule approval admin workflow / reviewer roles and latest legal rules
- Tax registration / small-business eligibility assessment beyond a self-reported profile
- End-to-end scenarios for mixed-rate, VAT-inclusive, delivery, POS and adjustments
- Correct VAT journals and invoices reconciliation
- NRS integration if required for the relevant taxpayer and transaction

Keep email, automatic tax filing and NRS e-invoice certification OFF until those checks are complete.
