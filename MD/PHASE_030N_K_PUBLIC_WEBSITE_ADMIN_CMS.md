# BusinessOS Phase 030N-K — Public website, brand controls, focused CMS and direct contact

## Source of truth and deployment

This project builds on the **Phase 030N-J professional invoices + pricing full source**, which includes earlier unpublished updates. Do not take the older GitHub `main` as a replacement without merging newer work. No code was pushed, merged, deployed, or applied to Supabase by the assistant.

## What changed

- **Public homepage**: concrete product categories, benefits, plan comparison and enquiry entry points. It does not claim unreleased payments, customer messaging or marketplace integrations are complete.
- **Public feature descriptions**: clearer sales, payments, invoice, stock, purchasing, team, exports and finance capabilities; qualified when gated or not yet deployed. Copy still supports the `public_site_pages` CMS. Existing custom page text is preserved.
- **Contacts**: public WhatsApp, call and email links shown on the Contact page, footer and a fixed unobtrusive help shortcut, but **only when contact details are configured**. WhatsApp URL constructed from digits, encoded greeting; no third-party scripts, no client hydration needed.
- **Platform Brand Studio**: `/admin/branding` has independent name, short name, tagline, public email/mobile number, colours, logo and favicon management; direct preview and support test links. Existing Supabase storage and platform branding auditing remain in use.
- **Website overview**: `/admin/website` is a small hub of purposeful navigation and publication counts instead of a piled branding form, plan editor and CMS.
- **Page library**: `/admin/content` lists pages with published/draft state. `/admin/content/[slug]` edits one allowed CMS page's heading, introduction, editorial sections and publication state. Legacy migration-016 boilerplate is replaced with suggested editorial content in the form only, never silently written to DB. Draft pages are not represented as public previews.
- **Pricing separation**: plan name/pricing/features remain under `/admin/plans` and `/admin/plan-access`, not repeated in each CMS page editor.
- **Marketplace**: no changes to verification, listings or directory implementation. Removed marketplace promotion from the global public footer while it is on hold.
- **Admin sidebar**: adds a prominent Brand Studio entry and points Website pages to the dedicated page library.
- **No SQL additions**: reuses existing `platform_branding.support_phone`, `public_site_pages`, `public_site_plans` and asset storage. System Owner authorization remains server-enforced.

## Enable WhatsApp immediately after deploying

1. Log in as System Owner and open **Brand Studio** (`/admin/branding`).
2. Set **WhatsApp and support mobile number** to a mobile you control, e.g. `+2348012345678` (example only; **never use this as a real number**).
3. Set the support email, brand name, logo and favicon if desired.
4. Save the brand changes. Use the **Test WhatsApp contact** link; then check the public site footer, floating shortcut and `/contact` page.
5. If the logo/favicons will not upload, verify the existing `platform-brand-assets` storage bucket and migration 026. Do not put service-role keys in frontend code.

If `support_phone` is blank, WhatsApp links are intentionally hidden; the developer does not know the owner's WhatsApp number. A separate WhatsApp and voice-phone field could be added later with a dedicated migration if those differ.

## Acceptance test for website and CMS

- Check `/`, `/features`, `/solutions`, `/how-it-works`, `/about`, `/pricing`, `/contact` on desktop and mobile; verify website copy is comprehensible.
- `/admin/website` should have no crowded CMS or branding input forms.
- `/admin/branding` should allow a System Owner to change name, logo and contact details without modifying a client business.
- `/admin/content` should show all 10 supported pages. Edit **Homepage** and **About**, save and verify actual published changes; do not overwrite existing custom content unexpectedly.
- Confirm published page headings/sections are CMS-sourced. Product cards and certain layout components are **still code-driven**, not a complete drag-and-drop visual CMS.
- Confirm a non-admin cannot access any of these editors (server authorization required).
- Confirm no public WhatsApp link when number is absent/invalid and a valid international/mobile URL when provided.
- Confirm draft legal placeholders are not presented as an approved privacy or terms policy. Final legal documents must be reviewed and published by the operator before launch.
- Check published plans reflect actual saved subscription/module configuration. Unfinished modules must not be promoted as active.
- Test an authenticated customer and an anonymous visitor independently for CSS/layout regressions.

## Release gates / what is not claimed

- The UI and source checks do **not** prove the latest SQL 044–048 are installed. Billing, internal team updates, tasks and public listing workflows must be tested against the actual database separately.
- No native WhatsApp API, auto-reply bot, WhatsApp Business API, outbound customer messaging, or customer CRM messaging integration was added. This release provides **click-to-chat** contact links.
- This release does not implement a full visual drag-and-drop CMS or make every homepage layout element editable through admin.
- Full Next.js build, actual Vercel Preview, browser/mobile testing, performance measurements, and live contact verification remain pending until the changes are deployed.

## Recommended promotion sequence

1. Create a new GitHub review branch and merge the **cumulative source** or carefully apply the **changed-files** patch to the matching Phase 030N-J baseline.
2. Run `npm ci` if the repository has a valid `package-lock.json`; otherwise generate/sync a lockfile in a controlled development environment. Run `npm run typecheck` and `npm run build`.
3. Run `node scripts/verify-phase30n-k-website-admin.cjs` and remaining source regressions.
4. Test Vercel Preview before production, including asset storage/branding changes.
5. Configure the real email and WhatsApp number under Brand Studio and verify links.
