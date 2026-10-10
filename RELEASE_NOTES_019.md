# Phase 019 — Plan Entitlements and Staff Page Guards

## Added
- SQL migration `019_plan_entitlements.sql`, using verified platform-admin functions for editing premium plan features.
- `business_has_feature` RPC that confirms business membership and checks an admin-approved plan assignment.
- Plan access editor `/admin/plan-access` to toggle features per plan, subject to Super Admin access.
- Page-level server checks for accounting, financial reports, tax, communications, campaigns, inventory, insights, growth, team.
- Role matrix to restrict sensitive pages to matching staff types.

## Important limitations
- Page checks do not replace API-action and database permission checks. Direct database access and every server action must also be reviewed.
- New businesses without approved plans retain core operational pages but premium modules are disabled.
- Missing plan feature configurations are disabled. Super Admin must enable plan features in `/admin/plan-access`.
- No billing service, paid payment processing or automatic plan approval added.
- Migration has NOT been executed against production Supabase; test in staging before applying.
