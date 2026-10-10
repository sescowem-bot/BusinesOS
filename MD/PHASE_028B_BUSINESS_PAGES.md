# Phase 028B — Business screens and workflow design

## Scope

Based on the Phase 028 corrected complete source, this change is a focused UI/UX release for customer-facing operational pages, not a database migration.

Changed screens:

- Customers: search, balances and contact summaries, explicit record limits and error treatment.
- Orders: status filters, paid/part-paid counts and quick links to order details.
- Products and services: catalogue search, clear active and low-stock labels.
- Payments: receipt and outstanding summaries and printable acknowledgement links.
- Invoices: issued-invoice list separated from live order statements.
- Order details: consistent financial summaries and better action sections.
- Reports and Inventory: aligned headings and improved report summary presentation.
- New customer and new order: structured, responsive form panels.

New shared UI components: `components/business-records.tsx` and `components/business-page-ui.tsx`. Records are loaded on the server from existing business-scoped queries; search, filtering and pagination operate only on the **currently loaded subset**. No new browsing APIs, financial posting logic or privileges are introduced.

## Important accuracy notes

The Customers page caps linked customers at 250, and its financial aggregates load at most 1,000 orders and 1,000 payments. Other lists have documented limits. Figures are labelled as pertaining to loaded records; do not treat them as complete-period accounting statements.

Payments are counted only if status is `completed`, and cancelled orders are omitted from outstanding calculations. Payment acknowledgement screens remain operational records, not independent payment gateway verification.

Core order and payment actions remain with the existing server actions and existing Supabase RLS. This release does **not** establish completeness of server-side permission checks, financial posting correctness or tenant isolation. Those require independent integration/security tests.

## Installation

1. Back up the current repository and take a database snapshot according to your normal process.
2. Merge the focused Phase 028B changed files into the current GitHub branch. Do not copy the patch folder as a nested project directory.
3. Run `npm ci` only if a matching lockfile exists, or otherwise install dependencies while generating and committing a suitable lockfile.
4. Run `npm run check:routes`, `npm run check:phase28b`, `npm run typecheck`, and `npm run build`.
5. Deploy to Vercel Preview and test pages as business Owner, Finance, Sales, Inventory, ordinary Staff, and unauthenticated user, including mobile widths, zero records and list limits.
6. Confirm read access is business-scoped, finance figures match selected transaction fixtures, and order/payment actions still work end to end.

## Not included

No SQL migration, full live browser test, online gateway integration, bank reconciliation, unbounded server pagination, or changes to Resend.

## Test evidence from source environment

The existing route and regression scripts and the Phase 028B custom source assertions passed. A complete Next.js production build was **not** possible because dependency installation failed with DNS `EAI_AGAIN` for the npm registry. Production build status remains unverified until GitHub/Vercel runs.
