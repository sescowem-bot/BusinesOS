# Phase 030N-D — Staging acceptance matrix (not yet executed)

Perform with separate real staging accounts (Platform Admin, Business A Owner, Business A Sales, Business B Owner) and record actual SQL evidence for each test.

1. Migration 044 runs once after 043 and expected RLS, triggers, RPCs and constraints exist.
2. Free direct premium features enabled before migration are included in the cleanup audit and disabled afterwards.
3. A Free plan inheriting any paid plan is cleaned up and cannot be assigned a new parent.
4. No business assigned Starter, Growth, Professional or Enterprise changes its assigned plan.
5. Explicit Free-company premium extras remain recorded, with role, reason, expiry and audit history; expiration is honoured by `business_has_feature`.
6. A newly created Free business receives only core features unless Super Admin explicitly grants extras.
7. Plan editor saves numeric monthly and annual NGN amounts, with accurate display on public pricing and account upgrade pages.
8. Negative, overprecision, too large or malformed plan price values are rejected.
9. Free plan always displays ₦0 and cannot be priced above zero through the admin or SQL row updates.
10. Company A negotiated monthly/yearly module price does not affect Company B or global price catalogue. No payment is charged by saving a price.
11. Company feature grants and business company prices do not automatically activate each other.
12. Business details display effective module source from plan/inheritance or separate extras correctly.
13. All 11 supported module categories and documented workflows are discoverable and readable on desktop and mobile.
14. Create company role `Cashier` based on Sales and allow only POS module.
15. Assign `Cashier` to a *Sales* member. They have POS only if business also has a POS entitlement. Access to other premium modules is blocked, even when otherwise included by plan.
16. Attempt to assign `Cashier` to a Finance member or create an Owner custom role: reject without changing their base role.
17. Attempt to assign any custom role to existing Owner: reject.
18. Manager role restricted to a permitted subset of plan modules cannot use excluded modules.
19. Disable a role profile: affected assigned users lose corresponding premium module access while underlying ownership remains intact.
20. Business Owner keeps access to entitled modules and platform admin does not impersonate a business user.
21. Member with no custom role keeps prior DB role behaviour; no permissions are broadened by migration.
22. Unauthorized authenticated user and other business cannot write plans, custom-role assignments, prices or grants via REST or RPC.
23. All role, price and grant changes leave attributable audit evidence; check identity and timestamps.
24. Existing POS, branch stock, supplier receiving, VAT, sales, expenses, dashboard, support and invoice regression checks pass.
25. Live Vercel Preview build, clean `npm ci`, `npm run typecheck`, `npm run build` pass.
26. Mobile 360px–430px: plan/role forms remain legible, checkboxes have touch targets and no content overlaps.
27. Server-query latency on admin pages stays bounded (business feature/roles tables contain at most 11/75 bounded rows), and no private business data is cached publicly.
28. Rollback/backout plan is reviewed before production. Never rerun SQL 044 on a partially installed production schema without inspecting actual migration state.
