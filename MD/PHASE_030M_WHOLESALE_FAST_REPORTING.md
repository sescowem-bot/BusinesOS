# Phase 030M-A — Wholesale Reference Tiers & Fast Retail Reporting

**Release status:** source prepared; **not yet deployed**. This package builds directly on the previous BusinessOS performance-hardening source and preserves Phase 030L-B authentication/mobile changes and Phase 030L premium POS.

## Speed is a non-negotiable release requirement

- `/retail-reports` calls **one authenticated, server-side PostgreSQL reporting RPC**. It does not download the orders, payments, customers and order-item datasets to the browser.
- The report accepts a maximum **92 calendar-day sale-date window** and returns only aggregated summary fields, up to **20 product groups** and **20 locations**. Date filters use GET to avoid a large client-side dashboard library.
- Migration **041** adds business/date, POS-order, payment, return and item-lookup indexes for the new report.
- `/wholesale` limits active product and reference pricing lists to **200 records each** and refuses writes when that limit is reached rather than permitting blind updates. A paginated lookup is needed for larger catalogues.
- No new charting package, external API, heavy animations, background polling, or subscription to live database updates is added.
- Reports and price reference records are **private**: they must not be cached in a public global cache or shared between businesses.
- The core landing-page performance optimisations remain in place. These features are separate from the public site critical rendering path.

## Features

1. **Wholesale price tiers:** Owner/Manager can set a reference unit price from a specified quantity, for any active product. Tier prices must not exceed the current retail price, must have a positive price, and quantity must be at least two. Tiers are stored in their own table with business-scoped uniqueness and update attribution.
2. **Wholesale quote RPC:** A salesperson can request a single-product quantity price quote through `business_wholesale_price_quote`. Its result is explicitly marked *advisory*, not a taxable final sale.
3. **Retail performance:** Management and Finance users with the `financial_reports` feature can request retail POS metrics by sale dates. Shows gross order totals, net sales ex VAT after completed credits, recorded VAT and credit reversal, received-payment snapshots, estimated item costs/margin and missing location assignments.
4. **Product movement:** Highest 20 product/name groups, using original order-item cost snapshots, original reviewed VAT taxable bases when available, and recorded completed returned quantities.
5. **Location comparison:** Highest 20 locations by gross POS order value, with unidentified historical sales labelled `Historic / unassigned`.

## Important boundaries

- **Wholesale tiers are reference prices only.** They **do not automatically change** the VAT-calculated POS checkout, customer invoice, stock reduction, partial payments or returns. A later guarded server-side wholesale checkout must be written and tested before automatic wholesale order pricing is enabled.
- Margin is an **estimate from original item-cost snapshots**. It is not general-ledger profit, inventory valuation, a reconciled VAT return, or bank cash flow.
- **Date grouping follows original POS sale date.** Recorded payments and completed credit notes may occur later and are allocated back to the corresponding sale-date cohort for analysis, not to the day cash moved.
- Existing financial statements on `/reports` remain posted-general-ledger based and must not silently include these gross POS estimates as posted income.
- Performance has not yet been benchmarked on live production-sized datasets, and no full `next build` or live Supabase SQL execution took place in this environment.

## Install after existing migrations

1. Backup the live database and GitHub repository.
2. Verify **SQL 040** is applied and the Phase 030L verification checks pass. Migration **041** requires SQL 040. Do not reapply 001–040 just to install 041.
3. On a staging Supabase database, apply `supabase/migrations/041_wholesale_pricing_pos_reporting.sql` once.
4. Run `MD/VERIFY_SQL_041_READ_ONLY.sql` and inspect all objects and RLS. Do not continue if any are missing.
5. Deploy the matching source to Vercel Preview. Confirm authentication, subscription gates, reporting and catalog loading.
6. Test the scenarios below with separate owner, manager, salesperson, finance and unrelated-business accounts. Check that migration 041 does not edit historical financial records.
7. Run `npm run check:routes`, `npm run check:phase30m`, `npm run typecheck`, `npm run build` and the existing regression commands. Enable the production release only after **staging integration tests** and route performance measurements pass.

## Staging functional and performance acceptance

| ID | Scenario | Expected behaviour |
| --- | --- | --- |
| M01 | Open public homepage after updating source | No new wholesale/reporting JS or private RPC is requested |
| M02 | Owner creates wholesale tier qty 10 price below retail | Tier created, full retail pricing unchanged |
| M03 | Duplicate product + threshold submitted | Existing tier updated, not duplicated |
| M04 | Price exceeds current retail price | SQL rejects and leaves records unchanged |
| M05 | Staff from another business tries same product | SQL/RLS refuses access |
| M06 | Sales staff tries to modify tiers | SQL rejects; salesperson may read quotes |
| M07 | Same product qty below threshold and above threshold | RPC returns regular vs advisory tier price |
| M08 | Retail POS with 10 units | Still uses tax-approved catalogue price, not wholesale tier |
| M09 | 30-day report, no POS sales | All amount/count metrics return zero; no crash |
| M10 | Standard VAT POS sale with part-payment and completed return | Revenue/credit/payments/cost based on original order snapshots |
| M11 | Branch sale with missing location | Counted as `Historic / unassigned`, never guessed |
| M12 | More than 20 products/locations | JSON response includes at most 20 each |
| M13 | Report 93 days or malformed date | Rejected before expensive query |
| M14 | Finance without financial_reports entitlement | Both UI and RPC deny access |
| M15 | Unrelated business attempts report RPC | SQL refuses; no cross-tenant data |
| M16 | 100k+ POS sales staging dataset | Capture EXPLAIN/ANALYZE in staging and page timings; review indexes and tune query before launch |
| M17 | Slow Android/3G profile in Chrome DevTools | Compare load-to-useful-content and transferred bytes before/after; avoid new mobile bundle regressions |
| M18 | Mobile product tier form with 200 items | Search, touch targets, layout and form submission remain responsive |
| M19 | Existing invoice, cash reconciliation, return, stock, SMTP and auth flows | No regression |
| M20 | `npm run typecheck && npm run build` | Must pass before promotion |

### Suggested performance budget, not a measurement

Use a **p75 target of LCP <= 2.5 seconds and INP <= 200ms on representative mobile users**; measure Core Web Vitals via a real-user or lab tool. For 30-day report requests, start with a target **database RPC p95 under 2 seconds** on staging-sized data, then adjust query execution plans. These are goals, not achieved claims.

## What follows

Phase **030M-B**, if automatic wholesale checkout is required, must integrate price tiers **inside the tax-reviewed, branch-stock locked, idempotent POS transaction**—never as a client-only price override. Phase **030N** then consolidates enterprise concurrency, security, accounting, performance/load and deployment validation.
