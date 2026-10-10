# BusinessOS — Public Website Refresh (Phase 024A)

## Why this release
The current BusinessOS public site contained generic marketing text and unpublished legal routes. This update addresses the public website before Phase 025 accounting work. The business dashboard, Admin, migrations 001–022, and payment/invoicing features are retained.

## Implemented
- Redesigned homepage hero, illustration, feature cards, workflow, industry solutions, CTA and footer.
- More professional and realistic copy for Features, Solutions, How It Works, About, Resources and Contact, without suggesting unfinished tax filing or communication delivery is active.
- Accessible responsive header, Company navigation, mobile menu, active-link state, keyboard escape closing, skip link and reduced-motion animation support.
- Privacy, Terms and Cookies routes now render. Unpublished/missing policies show **DRAFT / UNDER REVIEW** information rather than HTTP 404 or pretending to be an approved legal policy. Draft legal pages are excluded from indexing via page metadata.
- Fixed footer navigation on the homepage and all secondary public pages.
- CMS continues to override public content when edited and published. For untouched migration-016 starter content, the public site now displays stronger editorial defaults. CMS editors see suggested replacement text for original boilerplate; changes do not write to the database until a Super Admin saves them.
- A missing Cookies CMS record can be created through the existing editor at `/admin/content` (no migration required).
- Basic legal placeholder publishing guard prevents accidental publication of the exact original draft text. A qualified review and approved content are still necessary.
- The previous fictitious hero sales numbers have been replaced by a clearly labelled product illustration without account data.

## Deployment
1. Back up the repository and review the diff; all paths in the ZIP are rooted at the repository top level.
2. Use the **changed-files ZIP** if your repository already has newer changes; use the **full-source ZIP** only when upgrading from Phase 024 source.
3. Run `npm install` to obtain dependencies, `npm run check:routes`, `npm run check:website`, `npm run typecheck`, and `npm run build`. Deployment must stop on a failing typecheck or build.
4. Deploy to Vercel Preview. Test `/`, `/features`, `/solutions`, `/how-it-works`, `/about`, `/resources`, `/contact`, `/pricing`, `/privacy`, `/terms`, `/cookies` at desktop/mobile sizes.
5. In `/admin/content`, review the editorial content and complete **and legally approve** Privacy, Terms and Cookies before ticking Publish. Publish these texts only once they match actual data-handling, cookies and commercial arrangements.
6. Test account-dependent public navigation for guest, active System Owner and business accounts. Then promote Preview to Production.

## Database
No new SQL migration is required for this design release. Existing migration 016 controls CMS pages. The Cookies record may be created using the provided CMS editor. **Do not rerun migrations 001–022**.

## Verification performed locally
- Route audit: 51 existing pages, no duplicate URLs.
- Static public-website checks: passed.
- Phase 021–024 source checks: passed (including calculation, tax and reporting tests).
- TypeScript / TSX syntax parse: passed.
- Full TypeScript typecheck, Next.js optimized build, Vercel runtime and real Supabase interactions: **not executed/verified** in this environment due to unavailable project dependencies.
- Visual inspection in a running browser and legal/regulatory review: **pending**.

## Deliberate boundaries
The redesigned hero is an illustration and does not claim live stats. The legal page placeholders are **not** legally operative privacy, terms or cookie documents. Existing published CMS custom content is not overwritten. The comprehensive Admin / business dashboard design phase and accounting Phase 025 remain separate.
