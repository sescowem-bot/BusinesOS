# BusinessOS — System Owner workspace redesign (Phase 025B)

## Purpose

Replace the disconnected administration pages with a professional, consistent, responsive administration workspace. This update focuses on design and navigation. It does not create financial or subscription data and does not bypass server-side permissions. The existing customer dashboard remains unchanged.

## Main changes

- **Shared admin layout:** all `/admin` pages now sit inside a protected sidebar, top bar and footer. Access is checked on the server against active `platform_admins` membership.
- **Navigation:** Overview, Website overview, Pages and content, Pricing plans, Email templates, Registered businesses, Upgrade approvals, Features and roles, Notifications, System health, My Business and public website.
- **Dashboard:** real counts of businesses, published pages, plans and pending requests; recent real businesses, pending upgrade requests, quick actions and unavailable-service notices. No invented revenue, customer counts or completed transactions.
- **Website Management:** editorial control-centre with quick destinations, publication figures, branding form and brand preview.
- **Business directory:** cleaner, responsive data table, search and business links. Existing privileged RPC remains unchanged.
- **Responsive layout:** collapsible mobile menu, readable cards and tables, reduced-motion preference, accessible focus and active-link indicators.
- **Sign out:** remains a Supabase server action and can be used in the persistent top bar.

## Routes (after deployment)

`/admin` — overview
`/admin/website` — website control centre
`/admin/content` — CMS
`/admin/businesses` — business directory
`/admin/my-business` — personal business selector
`/admin/plans` — create and publish pricing
`/admin/plan-access` — feature and staff role permissions
`/admin/upgrades` — subscription approvals
`/admin/notifications` — alerts
`/admin/email` — templates
`/admin/health` — diagnostics

## Installation

1. Base version: latest Phase 025 source with the Expenses and Upgrade TypeScript corrections. The paused Phase 026 Resend/Auth work is **not** included in this release.
2. Back up the current GitHub repository and compare the changes with your current branch. Prefer the changed-files patch if additional code was added since the last package.
3. Copy the new/changed files into their matching root paths. Do not create an extra top-level project directory.
4. Run `npm run check:routes`, `npm run check:admin-ui`, `npm run typecheck`, then `npm run build` in a real Node.js installation.
5. Test as an active Super Admin and as a business-only user. In particular, verify mobile menu, business directory, content forms, pricing plans, upgrade approvals, Personal Business navigation and sign out.
6. Deploy to Vercel Preview before promoting to production.

## Dependencies and safety

No new SQL migration, environment key, payment service or external UI library is introduced. `lucide-react` is already in `package.json`. All existing CMS and business functions remain unchanged; new dashboard figures come from existing Supabase tables and the protected `platform_business_directory` RPC. Where a database query fails, display `—` or an error state rather than a made-up number.

## Verification boundaries

Static source checks and route tests do not prove a full production build, responsive browser performance or a live Supabase environment. Confirm those on Vercel Preview. No GitHub push, database write or deployment is performed by this package.
