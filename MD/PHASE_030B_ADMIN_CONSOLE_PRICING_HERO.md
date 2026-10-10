# Phase 030B — Admin Console, Plan Categories and Public Website Polish

## Scope

This release builds upon the Phase 030A mobile-navigation source. It preserves existing Supabase authentication, role checks, business operations, platform CMS, dynamic plan entitlements, migrations 001–028 and notification/email foundations. No migration is introduced.

## Changes

1. The public website shows an **Admin Console** entry only when the existing server-side viewer role returns `admin`. The link opens the server-gated `/admin` workspace. `My Business` remains separate. Mobile navigation has a dedicated System Owner section with Website and Business management links.
2. The System Owner sidebar has a searchable menu organised by Control Centre, Website Management, Business Management and My Workspace. The header has **Find tools**, a direct **My Business** switch, notification alerts and sign out. Keyboard users can press Ctrl+K or Cmd+K to focus the search/open the mobile drawer. Mobile navigation remains dismissible using Escape, the close button and its backdrop.
3. Pricing introduces four *illustrative business-stage categories*: Starter, Growth, Professional and Enterprise. These are guidance labels, **not automatically available or assigned plans**. Actual approved plans, visible pricing, entitlements and role access continue to come from Supabase CMS/RPCs. Non-numeric placeholders such as Contact sales are displayed as `Pricing on request`; no prices are invented. Publishing additional categories requires the existing `/admin/plans` and `/admin/plan-access` tools.
4. Interior marketing pages render distinct accessible CSS/SVG-icon product illustrations instead of reusing the same homepage workflow mockup. Features, Solutions, How it works, About, Resources each have distinct visuals and palette accents. Legal and Contact pages continue using their compact layouts. No fabricated testimonials, customer totals or revenue figures are shown.
5. Public Company dropdown is keyboard/click operable through native `details/summary` semantics. Responsive breakpoints and reduced-motion behaviour are retained.
6. CI runs `npm run check:phase30b` as an additional static safeguard. Documentation stays under `MD/` except for the root `README.md`.

## Deployment and rollback

1. Confirm the repository is based on the Phase 030A mobile repair, or review all diffs before applying this patch to a different base. Back up `main`.
2. Apply the changed-files patch at the **repository root**, preserving folder names. On GitHub, use a review branch and open a PR.
3. Run `npm install` (or `npm ci` when a matching lockfile exists), `npm run typecheck`, `npm run check:routes`, `npm run check:phase30b`, and `npm run build`.
4. Deploy to Vercel Preview first. Check guest, business-user and active-platform-admin sessions on mobile and desktop. Confirm only active admins see `Admin Console` and the protected `/admin` pages reject all others.
5. Visit `/pricing` with **zero plans**, **two published plans**, and **four or more published plans**. Verify CMS plan changes reflect on the website and that recommended category cards do not change entitlements.
6. Visit `/features`, `/solutions`, `/how-it-works`, `/about`, `/resources`, `/contact`, `/terms`, `/privacy`, `/cookies` and verify different hero visuals, correct legal review notices, layout fit and screen-reader semantics.
7. If the preview tests pass, promote the preview to production. Roll back to the previous Vercel deployment if any critical regression occurs.

## Verification performed on the source

- `node scripts/check-routes.cjs`: 56 routes, no duplicates.
- Phase 021–030B regression command suite: 16 checks passed.
- Changed TS/TSX source: parsed without syntax errors.
- Live production build, Vercel Preview visual tests, Supabase RLS and browser accessibility tests: **not run in this environment**. Do not claim this release is production certified until they pass.

## Remaining launch blockers

- Full npm dependency installation, TypeScript typecheck and Next.js production build in a networked CI environment.
- Mobile/desktop visual review across sizes including the System Owner and business dashboard.
- Integration and security tests for RLS isolation, accounting reconciliation, email delivery and staff role enforcement.
- Publish and review final Terms, Privacy and Cookies content before commercial launch.
- Configure real published plan labels and any desired subscription prices in the Super Admin; the category guide does not set prices or change approval policy.
