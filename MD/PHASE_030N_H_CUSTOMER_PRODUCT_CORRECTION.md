# BusinessOS 030N-H — Customer-ready product correction

**Source**: Cumulative local BusinessOS 030N-G project plus this release. GitHub main was reviewed for comparison; no GitHub files were changed.

## Why this release exists
The live-looking installed desktop app exposed staging/placeholder features, the old administrative upgrade flow, technical communication provider fields and UUIDs where customer names belonged. BusinessOS customers should see only tools their workspace is entitled to use. An active business subscription should not require platform administrators to authorise ordinary business actions.

## Changes included
- **Navigation**: a business-scoped, single RPC retrieves current entitled premium features. Sidebar entries for premium tools appear only with a valid entitlement. Hidden unfinished menu entries include custom automation service requests, outbound campaigns, partner placeholder, and unimplemented quote creation. Direct URL backend authorisation remains authoritative.
- **Staff**: every business owner can invite and manage staff using existing owner-only database RPCs. Invitations can be shared as secure email-bound links; Resend email is attempted only when configured. Recipients accept invitations while signed in with their verified invited email. Owners may set business-specific display names. These display names do not change authentication identity.
- **Tasks**: a real business-scoped task register (create, assign, complete and reopen) with role permissions and row-level security. Regular staff can view their own assignments, not every task in the organisation.
- **Communications**: customer display names replace database IDs. Draft/template pages no longer expose provider strings, technical phase numbers or pretend to send external messages.
- **Growth Centre**: concise action cards, expandable learning articles, real saved goal/document registers, and calculators with blank inputs rather than prefilled example financial numbers.
- **Business settings**: owners can update identity and location, upload PNG/JPG/WebP logos (2 MB max), and choose public business contact fields independently of their account email.
- **Public directory**: available without login at `/directory`. Displays only verified and *opted-in* businesses, with public details explicitly entered in Settings. Verification does NOT make a new business public automatically. Platform listing verification is distinct from subscription and workspace approval.
- **Plan changes**: monthly/annual Paystack **one-time payment** checkout with server-recorded prices, provider verified via Paystack API, HMAC-SHA512 webhook verification, idempotent server-role-only plan activation, payment history and premium entitlement expiry checks. No platform-admin subscription approval is required for a verified paid checkout. Paying again for the same active plan extends its period; switching a still-active paid plan to another plan is blocked until the existing period ends because proration has not yet been implemented.

## SQL sequence and prerequisites
**SQL 044 and SQL 045 must be installed and verified first** (these were NOT verified to be installed in the recent conversation). SQL 046 adds tasks, names, public profiles, storage logo policy, verification and navigation. SQL 047 adds paid checkout, billing history, expiry and verified activation. They are separate, transactional SQL scripts in `supabase/migrations/`.

1. Back up Supabase and run SQL 044 + SQL 045 on **staging** using the original migration scripts. Stop for conflicts or partial installs; do not re-run blindly.
2. Run SQL 046 on staging. Check tables `business_tasks`, `business_member_labels`, RPCs `business_workspace_features`, `business_save_task`, `business_name_staff_member`, storage bucket `business-logos`. Verify logo upload and RLS with two different businesses.
3. Run SQL 047 on staging. Check `business_subscription_payments`, the assignment `expires_at` column, and that the activation RPC is executable **only** by `service_role`.
4. Configure private server-only variables in Vercel Preview:
   - `PAYSTACK_SECRET_KEY` (test key initially)
   - `SUPABASE_SERVICE_ROLE_KEY` (private server; never prefixed `NEXT_PUBLIC_`)
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as for existing Supabase setup
   - `NEXT_PUBLIC_APP_URL` pointing to the **exact** Preview/canonical origin (also helps invitation emails)
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ENABLE_PLATFORM_EMAIL_DELIVERY=true` only if staff-invitation emails are to be sent
5. In Paystack, configure the webhook destination: `https://YOUR-DOMAIN/api/webhooks/paystack`. The server checks signatures and independently verifies the transaction through Paystack before activation.
6. Set numeric `price_monthly_ngn` and/or `price_yearly_ngn` on paid published plans through the existing System Owner plan editor. A plan without a positive price cannot be purchased. Free remains automatically assigned.
7. Run `npm ci`, `npm run typecheck`, `npm run build` in a connected CI environment. This container could not access the npm registry, so production build success is **not** asserted.
8. Use Paystack TEST credentials and transactions to verify: failure/pending doesn't grant access; success grants only the purchased plan; duplicate webhook is harmless; wrong amount/currency/reference doesn't activate; renewal extends; expiry removes paid module access; another business cannot read billing records.
9. Run business owner/member tests, public profile opt-in, and real iPhone Chrome/Safari/desktop PWA checks before production. Promote only after security sign-off.

**Do not set service-role keys on the client, in NEXT_PUBLIC variables, inside a React component, or in GitHub source.**

## Additional work that remains intentionally incomplete
- Outbound bulk email/SMS messaging, active automated campaigns, externally delivered two-way chat, partner marketplace agreements and automatic background task reminders are **not** claimed ready. Their menus are hidden or relabeled, but some old deep-link routes remain for previously stored records/admin workflows.
- The secure checkout is **one payment for one period**. Recurring automatic card charging, proration, refunds, chargebacks, tax receipts, invoicing and subscription dunning need a separate billing lifecycle before production-scale monetisation. Support must reconcile chargebacks and disputed payments; current SQL does not process them automatically.
- Quote creation, advanced team branch assignments, complete growth-document file storage and tax auto-classification require further development; hiding unavailable links is not equivalent to implementing them.
- Numeric pricing and payment flow are supplied in source but **must not be considered live without SQL 046/047, correct private environment variables, Paystack webhook setup, staging tests and a full production build**.

## Validation actually done in this container
- Existing source regression scripts (43) and new release checker passed.
- 78 application page routes are unique.
- TypeScript/TSX AST parsing completed without syntax errors.
- No actual Supabase, Paystack, Resend, Vercel deployment or physical-device test was run.
- `npm install --package-lock-only` failed with `EAI_AGAIN` to npmjs.org. Therefore `npm ci`, type-check and `next build` were unavailable in this environment.

## Deployment precaution
**Do not overwrite the latest unpublished local work with GitHub main.** The full-source ZIP is cumulative; the changed-files ZIP is a smaller patch against Phase 030N-G only. Review any newer branch modifications before merging. No changes have been pushed, deployed or run against production.
