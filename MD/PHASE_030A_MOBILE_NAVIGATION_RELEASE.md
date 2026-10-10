# BusinessOS — Mobile Navigation and Workspace Layout Repair (Phase 030A)

## What the screenshot showed

The deployed business workspace still displays the old navigation, with a wide desktop toolbar overflowing the phone and a fixed mobile strip containing only a few links. This is older than the Phase 030 source, which has a grouped drawer. The new repair improves the latest version and should be integrated into the current branch carefully.

## Changes

- Hamburger button in the mobile header and **All tools** in the mobile bottom bar open the same navigation drawer.
- Drawer contains every supported business link grouped by workflow, with text search and an explicit Close control.
- Active System Owners also see Platform Administration, Website Management, Business Management, Pricing and Pilot Readiness; ordinary business staff do not.
- Selecting a route or tapping outside closes the drawer; Escape closes it, and the body does not scroll underneath an open drawer.
- Compressed top bar no longer forces the business identity off-screen at 320–420px widths.
- Fixed bottom navigation includes Home, Orders, Customers, Admin (for active System Owners) / Payments (otherwise), and All tools. It reserves the iPhone safe-area inset.
- Team / Branches / Approvals cards are compact on mobile, and forms and lists can wrap within the viewport.
- Existing server-side role and Supabase access checks are unchanged. Hiding Admin for nonadmins is not the security boundary.

## Deployment

Recommended: first bring the deployed GitHub branch up to the verified Phase 030 source, then merge the focused 030A files. The older live `components/shell.tsx` has no mobile drawer, and this patch's CSS expects the Phase 028+ business workspace selectors. If merging into a branch with independent changes, review `app/globals.css` rather than replacing newer CSS blindly.

Deploy to Vercel Preview and test iPhone widths 320, 375, 390, 430px and Android 360–412px, plus tablet 768px and desktop. Check navigation to all modules, owner-only links, drawer close behaviour, horizontal scrolling, sign out, sticky footer, and forms.

No additional database migration is introduced by this repair. `supabase/migrations/028_pilot_acceptance_register.sql` is a separate Phase 030 migration and **must not be rerun** if already installed.

## Required verification

Run `npm run check:routes`, `npm run typecheck`, `npm run check:phase30`, and `npm run build` in CI. Manual device/browser visual testing and authenticated admin/customer checks are still required. This package was not deployed to Vercel or run against live Supabase.
