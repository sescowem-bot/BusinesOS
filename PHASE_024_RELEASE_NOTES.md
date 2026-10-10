# BusinessOS — Phase 024: Order-linked commercial invoices

## What changed

- Added **issued commercial invoices** that are distinct from dynamic order statements.
- Per-business, per-UTC-calendar-year invoice numbering: `INV-YYYY-000001`, generated atomically in PostgreSQL.
- An invoice is issued once per business order. Repeated issuance requests return the existing record (idempotent).
- Issued documents preserve business/customer/line/total/payment-at-issue data in an immutable JSON snapshot.
- Role check enforced inside an authenticated, security-definer PostgreSQL function. Allowed business roles: owner, manager, finance, sales.
- Row-level security restricts invoice reads to members of the corresponding business. Direct client insert/update/delete is not granted.
- A new print-ready `/invoices/issued/[id]` route displays a saved commercial invoice; the current `/invoices/[id]` order statement is retained.
- `/invoices` now lists issued invoices and recent orders; `/orders/[id]` offers an issue action where allowed.
- Currency in the issued document derives from the saved business profile and is printed with two decimals.
- Changed files include a Phase 024 structural source check and CI workflow call.

**Important limitation:** These commercial invoices are NOT represented as legally approved Nigerian tax invoices or e-invoices. Tax is a snapshot of the stored order, not a validated calculation or filing. The app still has no verified automated ledger posting, reconciliation or online payments.

## Database deployment

1. Confirm existing migrations **001–020** have succeeded (as reported by the user).
2. Check whether migration **021_admin_business_review.sql** from Phase 022 has been applied. If not, back up and apply it first in staging, then production after verification.
3. Back up the database, then run **only `supabase/migrations/022_issued_commercial_invoices.sql` once** in staging. Do not rerun previous migrations.
4. In staging, issue an invoice for a new order using a business Owner or Finance account. Issue the same invoice twice and verify the number remains the same.
5. Verify that a second business cannot see or issue the invoice, and a staff-only user cannot issue one. Verify cancelled orders cannot be invoiced.
6. Deploy code to Vercel Preview and run `npm install`, `npm run typecheck`, and `npm run build` before merging to production.
7. Verify newly issued invoice print view on desktop and mobile and check the current order-statement/payment-acknowledgement routes still work.

### Checks completed in preparation

- Route auditor **passed: 51 unique pages**.
- Phase 021, 022, 023 structural checks and Phase 024 structural check **passed**.
- Existing calculation, tax, reporting unit tests **passed**.
- TypeScript/TSX source **syntax parsing passed**.
- New migrations/row-security logic **not run on Supabase**; production integration tests outstanding.
- `npm install` failed with `EAI_AGAIN` because registry.npmjs.org could not be resolved, so **no full TypeScript typecheck or production build** was performed here.
- No GitHub commit, database mutation, Vercel deployment, or public-site change was performed.

## User experience redesign tracked separately

The Super Admin, Business Management and business-owner dashboards currently have uneven navigation, crowded pages, and inconsistent UI patterns. A dedicated **Phase 028 — Professional UX/UI System Redesign** is reserved for responsive layouts, clearer dashboard navigation, role-specific workspaces, searchable data tables, loading/error/empty states, better forms, real statistics, visual CMS workflow, and mobile QA. This does not block continuing functional integrations now, but must be completed before commercial launch.

## Remaining functional work

- Customer editing with tenant-safe history and confirmation.
- Quote-to-order workflow, credit notes, refunds, due-date monitoring and account statements.
- Genuine stock movement reservation, returns and cost tracking.
- Automated double-entry accounting from sales, payments, expenses and inventory.
- Secure Resend/Supabase Auth email hooks, live notification sending, delivery logs, opt-outs.
- Tax classification, effective-date rules and formal compliance review.
- Staff permission/RLS audits for **all** server actions and RPCs, including legacy CRM calls.
- Integration/E2E tests, full build, performance, accessibility, backups, launch staging/pilot.

See `PROGRESS_AND_REMAINING_ROADMAP.md` for estimated readiness.
