# BusinessOS Phase 030N-A — Fast, Clear Business and Customer Workflows

## Goal
Make customer-facing and staff-facing work easy for non-technical users without changing accounting, tax calculations, payment confirmations or role policies. This is a **source-code usability release**. It adds no database migration or new environment keys.

## Implemented

1. **Getting started**: `/getting-started` provides a clear journey: create a customer, add a product/service, create an order, see outstanding balances, and (for owners/managers) review staff roles. Only three count-only Supabase queries are made, and data errors display an explicit warning. The page does not fetch lists of customer personal data.
2. **One appropriate order form**: `/orders/new` now checks the business tax profile before choosing its form. Registered VAT businesses **must** have a reviewed profile and approved supply rules; the ordinary order form is not shown as an unsafe fallback. Non-reviewed/ordinary workspaces skip the two extra VAT supply queries entirely.
3. **Payment is part of the order journey**: The order form retains the existing initial-payment component with Unpaid, Part payment and Paid in full; the new short step guide explains the process. It does not charge bank accounts or cards.
4. **Start an order from the customer directory**: Authorised users can click Create order beside a customer. The query parameter is validated against the current business's fetched customer associations before preselecting a record in either order form.
5. **Actionable order register**: Unpaid or part-paid orders now link straight to the payment-history section of that order with a clear Review / receive payment action (non-sales roles see Review balance). Payment status language is explained above the list.
6. **Mobile-friendly tables**: Shared record tables turn into labelled, tap-friendly cards on narrow screens; semantic table markup and server-side data access are preserved. Search remains client-side for the loaded records only; no extra network requests per search or page change.
7. **Navigation and accessibility**: Getting started is reachable from both the dashboard and workspace navigation. Search inputs have accessible labels, fields are named in mobile cards, and focus indicators and reduced-motion handling are present.

## Performance priorities
- No new UI library, chart package, animation framework, client-side global state manager, or SQL RPC.
- Only the dedicated Quick Start page makes count-only queries (not a new query on every dashboard visit).
- Order creation no longer loads category/rule collections for businesses that do not require the registered-VAT form.
- Shared record tables still render a maximum of 20 records at a time, from their existing bounded lists.
- Client/customer financial records remain private and request-specific; no shared financial cache is introduced.

## Deployment instructions
1. Start from the **Phase 030M-C full source**, or merge this release's changed files into a matching review branch. Do not merge the patch into an older deployment without a diff/review.
2. Confirm migrations **031–042** required by the existing app are installed and staging-verified. **No Migration 043 is needed for this phase.** The package includes the existing migration files but does not execute them.
3. Run `npm run check:phase30n-ux`, `npm run check:routes`, all `verify-*.cjs` source checks, `npm run typecheck`, `npm run build`, and the staging checklist.
4. Test a non-VAT business, registered-and-reviewed VAT business, registered-but-unreviewed business, and a workspace whose tax profile query intentionally fails. No branch should permit incorrect tax fallback.
5. Test at widths 320, 375, 390, 430, 768, 1024 and 1440 pixels, with VoiceOver/TalkBack or keyboard navigation. Verify customer data is never exposed across tenants.
6. Verify before/after load measurements for `/`, `/dashboard`, `/orders`, `/orders/new`, `/customers`, `/getting-started`. Performance budgets should be agreed using actual Lighthouse/Web Vitals data, not assumed passing scores.
7. Push/merge/deploy **only after approval** and staging checks. The generated ZIP changes local source only.

## Known boundaries
- There is **no direct client/customer self-service portal** in this release. The user-facing changes target business staff, owners, and public registration/marketing continuity. Customer document sharing still depends on existing invoice and email workflows.
- Order and customer registers load only bounded datasets. Large businesses need server-side search and pagination; client-side table filtering applies to loaded rows only.
- No authentication, bank settlement, invoicing, VAT, receipt posting, expense or stock accounting logic is intentionally modified.
- Full Next.js build and live Supabase queries cannot be certified solely from syntax/source assertions. Previous source lacks a `package-lock.json`; create a reproducible lockfile in the deployment branch and complete CI build verification before production.

## Next release
Phase 030N-B should handle actual end-to-end transaction and tenant-security testing, verified build/CI, real mobile usability tests, performance budgets and any defects those tests expose. Do not label the platform Enterprise Validated until the database, Vercel and application tests actually pass.
