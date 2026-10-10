# Public Pages and CMS Release

## What changed
- Dedicated public paths: /features, /solutions, /how-it-works, /pricing, /about, /resources, /contact.
- Privacy and Terms are drafts and intentionally unpublished until legally reviewed.
- Global public navigation and mobile menu point to real pages.
- /admin/content offers editing of page headings, descriptions, JSON section arrays and published status.
- /admin/content also allows editing, adding, sorting and hiding commercial plan cards.
- Existing premium homepage remains in place.

## Required migration
Run `supabase/migrations/016_public_site_cms.sql` only after earlier platform administration migrations. Back up the database and test on staging. Public `SELECT` is restricted to published rows; mutations are restricted to active platform admins by RLS and server actions.

## Important limitations
- Pricing cards are editorial offers, NOT payment plans, subscriptions, metered billing or checkout. Avoid promising unimplemented features as live.
- The CMS content editor uses structured JSON for sections, not a full visual WYSIWYG. Future iteration can provide a block editor and media library.
- Initial seeded public pages use minimal text placeholders. Edit page sections before launch.
- Public pages are read-only; contact uses a support email mailto link and does not persist enquiries.
- No live Supabase migration or authenticated admin workflow was tested here.
- Keep existing branding and logo until changed deliberately by Super Admin.
