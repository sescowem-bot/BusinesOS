# BusinessOS: professional invoices and honest subscription pricing

## Release scope

This is an additive cumulative update on top of **Phase 030N-I and the two Vercel TS fixes**. Business records, invoice-issuance functions, VAT approvals, business tenancy, staff access, payment-ledger logic, and subscription-entitlement SQL remain unchanged.

## What changed

1. The issued invoice no longer displays the platform name or internal "NRS validated / immutable snapshot" disclaimer on its customer-facing footer. The customer's approved invoice footer note and a courtesy thank-you are retained. The tax rules themselves were not changed. Do not claim these PDFs are NRS-validated e-invoices.
2. Issued invoices have separate **Print document** and **Download PDF** controls. Download is now a real, downloadable A4 PDF generated on the server, not a browser screenshot or print dialog.
3. PDFs include business identity (name monogram, text, contacts), invoice number and issue date, customer, item descriptions, quantity, unit prices, amounts, total, tax amount, payments already recorded when issued, outstanding balance when issued, bank/payment instructions and the owner's footer message. The HTML invoice continues to render its uploaded logo, plus VAT item detail where appropriate. The PDF currently uses the business name/monogram, not an image logo; image-logo embedding is future work.
4. The API reads the authenticated business through `getWorkspace` and queries invoices by both invoice ID and business ID; there is no public invoicing endpoint and no cross-company disclosure. Responses are `private, no-store` and the PDF is an attachment with a sanitised filename.
5. Browser-print CSS now removes the platform navigation and targets A4 with no default page margin. Some print browsers can still add their own headers/footers: **uncheck "Headers and footers" in print settings if they appear**. Download PDF is the recommended customer-sharing option because it has no browser metadata.
6. The public pricing page now lists only plans the System Owner published, using the module catalogue from the database. Removed a second, hard-coded "suggested plan" list which contradicted actual published pricing. Where modules are displayed, describe their actual benefit rather than only a label.
7. Customer-facing invoice and order-statement text has been simplified without changing stored amounts.

## What did NOT change

- Plan module entitlements, rates or quotas have not been silently changed. The System Owner still uses `/admin/plans` for monthly/yearly pricing and `/admin/plan-access` to set modules and role permissions; published plan settings feed `/pricing`.
- No new SQL is required for this invoice/marketing update. Earlier SQL 044–048 must still be completed in sequence if their associated features are required.
- Downloading a commercial invoice PDF is **not equivalent to tax-authority validation, filing, or payment processing**. Such integrations remain separate.
- This update is not a complete live certification: npm registry and project modules are unavailable locally, so full Next production build and connected-Supabase testing must be done on Vercel Preview and staging.
- Logos are displayed on the HTML invoice. The native PDF uses a styled brand initial and business name; embedding externally hosted image logos safely is not part of this patch.

## Smoke testing

1. Create a sample order with two or more products, register a partial payment, and issue an invoice using your business workspace.
2. Open `/invoices/issued/<invoice-id>` and verify the invoice uses **business** branding and no developer disclaimer. Check that the HTML logo and bank details are correct.
3. Choose **Download PDF**: confirm a `.pdf` file saves directly to the computer, opens in a PDF viewer, and contains no printed URL or browser timestamp. Test the downloaded PDF with an unpaid invoice and a part-paid invoice.
4. Choose **Print document** and print to paper. Check the print preview hides the sidebar and navigation. If the browser adds the page URL/date, disable headers and footers in print options.
5. Test as a second business with a different customer: its members must not download the first business's invoice by changing the URL.
6. Verify an invoice with more than 15 items produces a readable, paginated PDF. Verify multi-page total and bank section at the end.
7. Verify public `/pricing` uses actual published plans and configured module lists; draft plans must not appear. Plans and roles are NOT modified by this update.
8. Run `npm run typecheck` and `npm run build` in a clean Vercel Preview deployment; test PDF download using a logged-in real business account.

## Source-level verification performed

`node scripts/verify-invoice-pdf-experience.cjs` performs security/UX source assertions and generates a real PDF in memory.
`node scripts/check-routes.cjs` checks unique page paths.
Existing `scripts/verify-*.cjs` tests check module and accounting invariants.
A sample PDF was additionally generated and rendered with Poppler to inspect page layout. This is **not** a claim of successful production typechecking or customer-visible PDF verification on Vercel.
