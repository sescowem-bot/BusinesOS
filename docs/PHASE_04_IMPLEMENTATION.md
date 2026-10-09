# Phase 04: Business Onboarding and Tax Discovery

## Implemented
- Owner-only editable tax discovery profile per business.
- Multi-select business activities, goods and services descriptions, legal structure, turnover bands, staff and VAT registration status.
- Individually listed supplies default to `needs_review`.
- Server-side authentication, owner permission checks and tenant RLS policies.
- Dedicated responsive `/tax-profile` page and dashboard navigation.
- SQL migration `005_business_tax_discovery.sql`.

## Deliberately not implemented
- Tax rates, tax eligibility decisions, automated tax charges or statutory returns.
- Professional review/publishing of classifications.
- Multi-workspace switching (first membership currently selected).
- Production database migrations and end-to-end verification.

## Deploy
1. Apply prior migrations 001 through 004, then migration 005.
2. Configure authenticated Supabase users and the workspace bootstrap.
3. Log in as an owner, visit `/tax-profile` and save the profile and distinct supplies.
4. Check another business owner cannot see or edit records across tenants.
5. Run `npm install && npm run typecheck && npm run build`.

## Important notes
Tax eligibility depends on current legislation and details not yet collected, including fixed assets, business subcategory and location of supplies. Turnover bands are discovery indicators, not eligibility decisions. Category classifications remain pending. No tax rate is hardcoded.
