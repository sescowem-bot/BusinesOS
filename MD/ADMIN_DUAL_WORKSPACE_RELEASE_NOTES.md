# BusinessOS — Admin Personal Business Workspace (Phase 024B)

## Scope
A System Owner may manage the platform AND use the normal customer operational dashboard for a personal business. These are two independent access scopes using the existing BusinessOS data model and auth account.

## Included
- `/admin/my-business`: administrator-only directory of businesses where the signed-in administrator personally has a `business_members` membership. Shows role, name and business category.
- `Open dashboard` action validates that the admin is a member of the requested business before selecting it.
- Create own business from the same admin screen using migration 004's `create_my_business_workspace` Supabase RPC. The RPC creates a normal business with the admin as business owner, but does **not** elevate access to other businesses.
- Selected business preference uses an HTTP-only, SameSite=Lax cookie. Every business request revalidates the selected ID against `business_members`; the cookie grants **no access by itself**. Invalid/stale choice falls back to the user's first valid membership.
- Easy return links to `/admin` from the business dashboard, with a `Switch Business` link.
- Discoverable `My Business` navigation in the public header, mobile menu, admin navigation and System Owner overview.
- Clears selected-business preference on sign out.
- Existing business feature, role and plan entitlement checks are left intact.

## Admin launch URLs after deployment
- Platform overview: `/admin`
- My Business / switch workspace: `/admin/my-business`
- Active business dashboard: `/dashboard`
- Website CMS: `/admin/website`
- Customer-business administration: `/admin/businesses`

## Database
No new migration. Requires existing migrations 001–020; recommended 021, 022 for prior features. The `create_my_business_workspace` RPC comes from migration 004. A valid `profiles` row is required for personal workspace creation.

## Important limitations
- This is **not** Super Admin impersonation; managing another customer's business operational data requires ordinary membership and the same permissions as a regular user.
- Admin status does not automatically grant premium modules to the admin's own business. Assign feature entitlements through your usual plan approval process. The separate platform admin pages remain available to you.
- Multi-business selection is implemented for the admin's linked businesses, not a global cross-customer workspace switcher.
- This is a navigation and role-integration release, **not** the full professional admin UI/UX redesign planned for a later stage.
- No live Supabase queries, Vercel deployment or full production build were executed in this environment. Tests below are static/source-level.

## Checks completed
- `node scripts/check-routes.cjs`: 52 distinct page routes, no duplicates.
- `node scripts/verify-admin-dual-workspace.cjs`: static privilege and linking checks passed.
- `node scripts/verify-phase21.cjs`, `verify-phase22.cjs`, `verify-phase23.cjs`, `verify-phase24.cjs`, `verify-public-website.cjs`: passed.
- TypeScript/TSX syntax parsing: 138 files passed through existing scripts (not equivalent to `tsc --noEmit`).

## Deploy/test sequence
1. Back up the GitHub branch and current Vercel deployment; merge changed files if your repository contains subsequent work.
2. Install project dependencies and run `npm run typecheck && npm run build`. Do not bypass TypeScript failures.
3. Deploy to a Vercel Preview URL connected to the same intended staging Supabase project.
4. Log in as an active Platform Admin; open `/admin/my-business`. It should list **only** your own business memberships.
5. If you don't have a business membership, create one. The business should appear under `/admin/my-business` with `owner` role.
6. Open the business dashboard, add one customer/product and make a test order; verify those records belong only to this business.
7. Switch between two businesses you actually belong to; verify data changes accordingly. Try a forged selection and confirm no other tenant's data becomes visible.
8. Verify ordinary customer accounts cannot open `/admin` or `/admin/my-business`.
9. Verify `System Owner` and `Switch Business` buttons on desktop/mobile, sign-out clears the business choice and sign-in works again.
10. Test Vercel runtime logs for errors before promoting to production.

## Files changed
- `lib/server/workspace.ts`
- `lib/server/workspace-selection.ts` (new)
- `app/admin/my-business/page.tsx` (new)
- `app/admin/my-business/actions.ts` (new)
- `app/admin/my-business/create-form.tsx` (new)
- `app/admin/page.tsx`
- `components/admin-nav.tsx`
- `components/public-nav.tsx`
- `components/shell.tsx`
- `app/(auth)/login/actions.ts`
- `app/globals.css`
- `scripts/verify-admin-dual-workspace.cjs` (new)
