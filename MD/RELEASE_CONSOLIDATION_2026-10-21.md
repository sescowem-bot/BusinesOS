# BusinessOS release consolidation — 21 October 2026

## Purpose
Keep the GitHub repository readable: **one PR per tested release**, focused source files, one ordered migration per logical database change, and no ZIP archives, generated backup folders, copied projects or credentials in Git history.

## Merged-safe website corrections in this PR
- Published priced plans cannot display stale "pricing to be confirmed" labels.
- Pricing editor explains the billing label and retains editable numeric checkout amounts.
- Browser and installed-app theme color follow the saved platform primary color.
- No database migrations, credentials, subscription grants, payment gateways or RLS policies are changed.

## Previously drafted packages — NOT part of this production-safe merge
The earlier staged packages 057 through 063 have **not** been verified against a complete deployed staging environment. Do not describe them as live or production-ready:
- Stage 057: Paystack test checkout and paid business add-on offers.
- Stage 058: account export and privacy fulfilment evidence.
- Stage 059: operational event logs.
- Stage 061: business and staff lifecycle controls (SQL 060).
- Stage 062: membership enforcement (SQL 061).
- Stage 063: erasure/closure request governance (SQL 062).

A properly integrated follow-up PR must use original `app/`, `lib/` and `supabase/migrations/` paths, not a collection of local installers or ZIPs.

## Required security/release gates for those packages
1. Consolidate the actual source updates and SQL from the stage packages into a clean feature branch, review overlapping changes and run a full `npm run typecheck` and `npm run build`.
2. Test SQL in a separate Supabase staging project with an up-to-date migration history. Never run staging SQL blindly against production.
3. Verify access for a guest, ordinary staff, suspended/removed staff, owner, suspended business owner, System Owner and service role, including legacy read-only RPCs and exports.
4. Verify Paystack test transactions, amount/currency, webhook signatures, duplicate delivery, idempotent activation, failed transactions, and refund/cancellation behaviour before enabling live payments.
5. Verify privacy requests use identity evidence and never treat an approved request as completed erasure.
6. Run CI and review the deployment preview; only then authorise a controlled production migration and release.

**Git recovery:** deleting a file in a later commit does not normally erase older committed revisions. Secrets previously committed require history rewriting and key rotation, not ordinary deletion.
