# BusinessOS Phase 030N-N — Admin Pricing and Public CMS Repair

## User-reported problem
The live `/admin/plans` screen places prices inside collapsed plan descriptions and prominently shows a separate **Save tier inheritance** operation. The inheritance RPC fails in the screenshot. The CMS can change page introductions and extra paragraphs but not the principal Home, Features, Solutions and How It Works cards.

## Source changes
- **Admin pricing:** Every plan appears immediately in a visible subscription-price section above the expanded plan details. Each gets independent monthly and annual NGN inputs and an explicit **Save prices** button. Updating prices leaves feature entitlements, staff permissions, publication state and descriptive content unchanged.
- **Separate plan marketing updates:** Saving an existing plan description explicitly updates text fields only. The numeric price fields are no longer sent in that save operation. New plan creation can still provide a price.
- **Admin feedback:** A missing pricing column / database migration, expired administrator session and duplicate identifier receive actionable, restrained messages. Database error codes are logged only on the server; they are not returned in raw form.
- **Inheritance:** The selection defaults to the saved relationship. With no change, the submit button is disabled and there is no RPC call. Actual changes still require the `admin_set_plan_parent(text,text)` database RPC and System Owner privileges. Neither the UI nor the code can make an absent RPC work.
- **Visual CMS:** Actual home feature tiles and workflow steps, feature catalog tiles, solution cards, and How It Works steps now read optional, keyed copy overrides from `public_site_pages.sections`. Existing editorial sections remain. Editors have labeled title/body fields and a text preview. The same existing column is used; **no new SQL migration** is required.
- **Site caching:** Saving the page invalidates public page caches. Prices update the published plan cache. Public pages have caching up to 60 seconds.
- **Validation:** CMS card keys are constrained to the allowlist for the selected page. Editors can keep previously entered long-form sections; text lengths and duplicate keys are checked server-side.

## Important limits
- Product page layout, buttons, icons and certain static supporting sections still require source changes. This is *not* a drag-and-drop WYSIWYG builder.
- Prices are commercial values only. Saving a price does not execute a Paystack payment, assign entitlements or activate a checkout session.
- Setting a subscription's parent changes module inheritance for businesses already assigned to the plan. Review effects before making real plan relationship changes.
- If SQL 044 is absent, saving monthly/yearly prices still fails; use `MD/PHASE_030N_N_READ_ONLY_DB_CHECK.sql` before changing the live database. If SQL 029 is absent, inheritance cannot be saved.
- The application was **not deployed** or tested against the user's Supabase project. No payments or role permissions were altered.

## Acceptance checks to perform in Vercel Preview
1. Log in as System Owner; navigate `/admin/plans`. Confirm that Free, Starter and Growth prices are immediately editable, and Free is fixed at zero.
2. Set a nonzero monthly price for Starter. Save, reload `/admin/plans`, then open `/pricing` and verify the public price after cache refresh. Do not use a live payment just to test price display.
3. Expand Starter, change only the marketing description, save and reload. Confirm the monthly/annual prices were **not** cleared.
4. On a plan with no parent, confirm the **Save tier inheritance** button is disabled. Choose another plan and confirm the RPC succeeds if installed. Otherwise inspect SQL readiness rather than blindly rerunning it.
5. Go to `/admin/content/home`. Change one homepage feature card heading, save, then open the homepage and confirm that specific card updates.
6. Repeat on `/admin/content/features`, `/admin/content/solutions`, `/admin/content/how-it-works`. Confirm the rest of the page and editorial sections remain unchanged.
7. Check the same pages on a narrow phone viewport, as well as keyboard navigation and error messages.
8. Verify Free remains ₦0 and the CMS editor cannot change premium entitlements merely by editing marketing copy.

## Verification performed locally
- `node scripts/check-routes.cjs`: 84 unique routes
- All 52 `scripts/verify-*.cjs` regression scripts passed, including Phase030N-N coverage
- TypeScript/TSX syntax parsed with global TypeScript: 276+ files
- The **full Next.js typecheck and production build were not run** because this source package has no installed project dependencies or package lock. Run `npm install`, `npm run typecheck`, `npm run build` in a clean, connected build environment before production.
- Real database and Vercel integration tests are still required.
