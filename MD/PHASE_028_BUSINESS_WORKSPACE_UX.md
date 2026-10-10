# Phase 028 — Professional Business Workspace UX

## Scope

This phase upgrades the customer-facing workspace using the existing BusinessOS design system and existing operational Supabase data. It does not change migrations, RLS policies, server actions, payment logic, financial calculation rules or the redesigned Platform Admin shell.

### Deliverables

1. Replaced the ungrouped workspace navigation with persistent groups for Overview, Sales, Operations, Finance, Engagement, and Workspace settings. Active roles and System Owner shortcuts remain conditional.
2. Upgraded the top bar with current page context, current business identity and role, unread notification indicator, System Owner access for active admins and sign out.
3. Added a responsive drawer and full-module navigation on smaller screens, with Escape and backdrop close handling and accessible navigation labels. Mobile quick actions remain available at the bottom.
4. Rebuilt the dashboard overview with four real operational KPIs, two operational count links, financial comparison bars derived from the existing insight aggregation, a meaningful insights/attention list and direct actions.
5. Styled forms, tables and inner pages consistently without altering their database operations; included mobile, print and reduced-motion fallbacks.
6. Added `npm run check:phase28` and retained earlier verification scripts.

### Validation limitations

All displayed dashboard numbers come from `loadBusinessInsights()` and represent actual stored operational data; they are not audited financial balances. Month-on-month percentages are omitted if the prior month's value is zero. Chart widths derive only from reported amounts. Low-stock and counts follow the existing insight query limits and validation.

The page redesign does **not** make incomplete modules operational. Existing planned features (external communications, statutory returns, reconciliation, marketplace) retain their earlier implementation state. No new database changes are required.

### Installation

Merge the changed-files package into the root of the GitHub repository and commit it. To reproduce changes without risk, use a new branch and Vercel Preview deployment. Do not delete existing source folders or replace newer unrelated modules.

Run:

```bash
npm ci  # if package-lock.json is present and in sync; otherwise npm install and commit the generated lockfile
npm run check:routes
npm run check:phase28
npm run typecheck
npm run build
```

Then visually check the UI at widths around 375, 768, 1024 and 1440 pixels. Verify business users cannot access platform links, Platform Admin users can reach both workspaces, notifications, orders, customers, expenses, reports and sign out still work. Check the drawer using keyboard Escape and touch. Reconcile monthly figures against actual orders, payments and expenses in a staging business.

### Follow-up before release

- Full TypeScript/Next.js build and visual browser review on Vercel Preview.
- Tenant isolation and role-based tests against live Supabase data.
- Add dedicated customer, invoice and inventory improvements after collecting feedback on dashboard interactions.
- Separate Phase 029 security/performance tests and Phase 030 pilot launch.
