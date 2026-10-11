# BusinessOS — Phase 030N-D: Structured Plans, Company Extras and Named Staff Roles

## Status
Source-level implementation prepared. **Do not mark production ready.** Full Next.js typecheck/build and live Supabase migration/RLS/concurrent permission tests have not been run in this environment. Existing source project does not include `package-lock.json` — regenerate and commit a correct lockfile (`npm install`) and run `npm ci`/`npm run build` in a clean CI environment before promotion.

## User-visible improvements
- `/admin/plans`: explicit Free, monthly/annual NGN price inputs, comparison of **8 core features** and **11 separately controlled premium modules**, plus a full explanatory workflow list. More than 11 tools exist, but only 11 are separately licensable module entitlements; workflows are not false entitlements.
- `/admin/plan-access`: built-in staff permissions for each plan. Free cannot be granted paid modules via direct plan assignment, even if an administrator selects them.
- `/admin/businesses/[id]`: structured **effective company access**: plan/inherited modules versus separately granted company extras, company-specific monthly and annual commercial prices, named custom staff role profiles and staff assignments.
- `/pricing`, `/upgrade`: show configured monthly and annual pricing rather than relying on ambiguous text labels. No automatic payment collection is introduced.
- Named roles: create e.g. `Cashier` with underlying secure `Sales` role and allowed modules `POS`. It only narrows module access and never bypasses checkout, stock, financial and approval checks already implemented for the base role. Existing Owner cannot be assigned a custom role or demoted by this tool. Base-role changes use their separate audited business-owner/support workflow.
- Feature-grant decisions continue to use existing `admin_set_business_feature_grant` with allowed roles, reason, optional expiry and audit records. Custom roles cannot create an entitlement, they only constrain entitled module use.

## Database migration 044
**Prerequisites:** migrations **001–043**, especially 019, 023, 029, 031, 042, 043.
**One-time change:** `supabase/migrations/044_structured_plan_entitlements_custom_company_roles.sql`.

**Important intentional cleanup:** SQL 044 disables any *direct premium module rows on `free`* and removes `free` inheriting another plan, storing their previous values in `platform_free_plan_cleanup_audit`. It also prevents re-enabling premium access on the Free plan. **It does not delete existing company-specific extras**, does not downgrade paid plans, and does not change account ownership. A Free business may still have individually approved courtesy or trial extras, clearly marked as such, with a role list, reason and expiry. Inspect these grants rather than assuming they are ordinary Free entitlements.

The migration creates `business_feature_prices`, `business_feature_price_audit`, `business_company_role_profiles`, `business_company_role_assignments`, `business_company_role_audit`, numeric monthly and yearly pricing columns on `public_site_plans`, and new admin-only mutation RPCs. Table RLS and direct-write restrictions are enabled. `business_has_feature` is extended so a named role is an additional entitlement ceiling, not a way around the original plan, RLS or staff base role.

### Safe deployment sequence
1. Back up the Supabase database and latest source. Confirm the actual environment has migrations 001–043 and the full matching source. **Do not deploy SQL 044 against the older GitHub branch with only migration 030.**
2. On a staging clone, use the read-only `MD/VERIFY_SQL_044_READ_ONLY.sql` first to inspect existing Free direct premium rows, Free inheritance and company-specific grants. Record the list of affected businesses and owners.
3. Run migration 044 once on staging and re-run the checker. Verify Free no longer has direct premium access, while explicit company extras remain unchanged.
4. Deploy this code to Vercel Preview. Review `/admin/plans`, `/admin/plan-access`, `/admin/businesses/[id]`, `/pricing`, `/upgrade`, and staff access as separate accounts.
5. Use `MD/PHASE_030N_D_ACCEPTANCE.md` with actual trial accounts before production.
6. Generate/commit `package-lock.json` and complete `npm ci && npm run typecheck && npm run build`, plus full source checks. Release only after real role, plan, pricing and workload tests pass.

### Notes and limits
- Prices and per-company price overrides are **commercial records only**; no Paystack, Stripe, invoice generation, automatic charges, upgrades or settlement are executed by recording a price. Configure payment and billing separately, with customer consent.
- Named roles **limit premium module access**. They are **not a new dynamic action-level RBAC engine** for every button in every module. Existing SQL procedures continue enforcing built-in role restrictions for sensitive actions (e.g. posting journals, stock transfers, cashier closing, refunds).
- Do not describe module workflows as separately payable or controllable permissions until they have independent endpoint and RLS enforcement. New functional products/features still require source implementation and migrations, not simply adding a text label.
- Costs shown publicly are NGN. Business-negotiated module prices are visible only to platform admins and relevant business owners, not anonymous visitors.
- Changes are restricted to plan/pricing/role/catalogue code. No modifications to POS ledger posting, transactional VAT calculation, payments or existing invoice amounts.
