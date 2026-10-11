# BusinessOS Fast Expenses & Loading Recovery — No-SQL Patch

## Observed screenshot
The business shell/sidebar is present at `/expenses`, but the main content shows the generic "Opening your workspace" loading fallback. A screenshot cannot prove an infinite hang or reveal whether Supabase, Vercel or the user's network is the principal source of latency.

## Verified source-level bottleneck
The previous `app/(dashboard)/expenses/page.tsx` awaited a tenant-authenticated Supabase expense query (newest **200** records, with a category relation) before returning **any** page content. The root workspace loading fallback stayed visible during that wait, even when the shell itself had finished loading. This release isolates that query from the expense heading and entry form.

## Changes
- `/expenses` displays a page heading and clear explanatory copy without waiting on its expense-record query.
- The authenticated form renders as soon as workspace role checks finish. Only Owner, Manager and Finance can create expenses, as before.
- A nested streaming Suspense boundary handles the expense register with a meaningful "Loading the latest expense records" skeleton.
- Records are fetched in **25-item** pages, with an extra row to detect Next. Previous/Next navigation is server-side, with only the current page queried.
- The displayed total is **only for that page**, never misrepresented as full-month or company-wide expenses.
- Expense amounts show two decimals to preserve kobo, and rows switch to labelled cards on narrow phones.
- The route now has a dedicated `loading.tsx` and client-side `error.tsx` with retry, Dashboard and Support links.
- `ExpenseForm` labels were simplified; the existing guarded `gl_record_paid_expense` RPC, accounting postings and access checks are unchanged.

## Installation
1. Compare source with the deployed GitHub version. Apply the **changed files only** ZIP to a review branch; preserve any project changes made since the provided source version.
2. There is **no SQL or environment variable change** in this patch.
3. Run `npm install` or `npm ci` with a committed lockfile, `npm run check:expenses-speed`, `npm run test:accounting`, `npm run typecheck`, and `npm run build`.
4. Deploy a Vercel **Preview** and test with Owner, Finance and Sales users on a business with 0, 25 and 200+ expenses. Sales can view records but should not see the creation form.
5. Verify mobile navigation, Next/Previous page, amount precision, record sorting, expense form submission and role restrictions.
6. Use Chrome DevTools Network > filter `expenses`, and the Vercel function logs to examine slow/errors in server requests. A skeleton displayed indefinitely requires investigation of the slow or failing request; this patch does not mask backend outages.
7. Promote only after the full build, UAT and live speed comparison pass.

## Performance acceptance
Measure on the same device/network **before and after**: click-to-visible heading, click-to-form, page data completion, request count, response time and mobile browser interaction. Repeat with a throttled mobile connection. No measured speedup or live Supabase behaviour is claimed by static tests.

## Security and accounting
Never cache the private expense list in a cross-user cache, and do not compute company-wide accounting totals from a single page of records. The business remains authenticated, tenant scoped, and permission checked. Existing GL source integration remains unchanged.
